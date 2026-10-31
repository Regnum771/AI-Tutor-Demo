import { ArchitectureView } from '../architecture/ArchitectureView';
import type { SceneProps } from './types';

export function Sc02Architecture({ t }: SceneProps) {
  return <ArchitectureView t={t} mode="reveal" />;
}
