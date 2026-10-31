import type { ComponentType } from 'react';
import type { SceneProps } from './types';
import { Sc01Fragmented } from './Sc01Fragmented';
import { Sc02Architecture } from './Sc02Architecture';
import { Sc12Closing } from './Sc12Closing';

export const SCENE_VIEWS: Partial<Record<number, ComponentType<SceneProps>>> = {
  1: Sc01Fragmented,
  2: Sc02Architecture,
  12: Sc12Closing,
};
