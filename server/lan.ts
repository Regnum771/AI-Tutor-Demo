import type { NetworkInterfaceInfo } from 'node:os';

const VIRTUAL = /vmware|virtualbox|vbox|vethernet|hyper-v|wsl|docker|loopback|tailscale|zerotier/i;
const WIRELESS = /wi-?fi|wlan|wireless/i;
/** VirtualBox's default host-only network; Windows names that adapter "Ethernet N". */
const HOST_ONLY = /^192\.168\.56\./;

/** The address a phone on the same network can reach: Wi-Fi first, then any real adapter, never a virtual one. */
export function pickLanIp(interfaces: Record<string, NetworkInterfaceInfo[] | undefined>): string | null {
  const candidates = Object.entries(interfaces)
    .flatMap(([name, list]) => (list ?? []).map((a) => ({ ...a, name })))
    .filter((a) => a.family === 'IPv4' && !a.internal && !VIRTUAL.test(a.name) && !HOST_ONLY.test(a.address));
  return (candidates.find((a) => WIRELESS.test(a.name)) ?? candidates[0])?.address ?? null;
}
