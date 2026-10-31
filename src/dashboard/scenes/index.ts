import type { ComponentType } from 'react';
import type { SceneProps } from './types';
import { Sc01Fragmented } from './Sc01Fragmented';
import { Sc02Architecture } from './Sc02Architecture';
import { Sc03Perceive } from './Sc03Perceive';
import { Sc08Govern } from './Sc08Govern';
import { Sc11Scale } from './Sc11Scale';
import { Sc12Closing } from './Sc12Closing';

export const SCENE_VIEWS: Partial<Record<number, ComponentType<SceneProps>>> = {
  1: Sc01Fragmented,
  2: Sc02Architecture,
  3: Sc03Perceive,
  8: Sc08Govern,
  11: Sc11Scale,
  12: Sc12Closing,
};
