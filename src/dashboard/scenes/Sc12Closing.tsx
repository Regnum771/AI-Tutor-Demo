import { ArchitectureView } from '../architecture/ArchitectureView';
import type { SceneProps } from './types';

export function Sc12Closing({ t }: SceneProps) {
  return <ArchitectureView t={t} mode="closing" />;
}
