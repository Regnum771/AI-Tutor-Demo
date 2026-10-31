import type { ComponentType } from 'react';
import type { SceneProps } from './types';
import { Sc01Fragmented } from './Sc01Fragmented';
import { Sc02Architecture } from './Sc02Architecture';
import { Sc03Perceive } from './Sc03Perceive';
import { Sc04Represent } from './Sc04Represent';
import { Sc05Reason } from './Sc05Reason';
import { Sc06Collaborate } from './Sc06Collaborate';
import { Sc07Orchestrate } from './Sc07Orchestrate';
import { Sc08Govern } from './Sc08Govern';
import { Sc09Experience } from './Sc09Experience';
import { Sc11Scale } from './Sc11Scale';
import { Sc12Closing } from './Sc12Closing';

export const SCENE_VIEWS: Partial<Record<number, ComponentType<SceneProps>>> = {
  1: Sc01Fragmented,
  2: Sc02Architecture,
  3: Sc03Perceive,
  4: Sc04Represent,
  5: Sc05Reason,
  6: Sc06Collaborate,
  7: Sc07Orchestrate,
  8: Sc08Govern,
  9: Sc09Experience,
  11: Sc11Scale,
  12: Sc12Closing,
};
