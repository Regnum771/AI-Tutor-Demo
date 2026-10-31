import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { pickLanIp } from './lan';

const v4 = (address: string, internal = false) => ({ address, family: 'IPv4', internal }) as NetworkInterfaceInfo;

describe('pickLanIp', () => {
  it('prefers Wi-Fi over virtual adapters listed first', () => {
    expect(pickLanIp({
      'Ethernet 2': [v4('192.168.56.1')],
      'VMware Network Adapter VMnet1': [v4('192.168.72.1')],
      'VMware Network Adapter VMnet8': [v4('192.168.37.1')],
      WiFi: [v4('192.168.1.183')],
    })).toBe('192.168.1.183');
  });
  it('falls back to a real wired adapter', () => {
    expect(pickLanIp({ 'vEthernet (WSL)': [v4('172.20.0.1')], Ethernet: [v4('10.0.0.5')] })).toBe('10.0.0.5');
  });
  it('skips internal and IPv6 addresses, and finds nothing on a machine with no network', () => {
    expect(pickLanIp({ lo: [v4('127.0.0.1', true)], WiFi: [{ address: 'fe80::1', family: 'IPv6', internal: false } as NetworkInterfaceInfo] })).toBeNull();
  });
});
