import { type ComponentType } from 'react'
import Intro from './1-Intro'
import Nerve from './4-Nerve'
import { Movement } from './6-Movement'
import Heart from './8-Heart'
import Run from './10-Run'
import { Victory } from './11-Victory'

export interface SceneEntry {
  label: string
  component: ComponentType<{ onComplete: () => void }>
}

export const SCENES: SceneEntry[] = [
  { label: '1-Intro',  component: Intro },
  { label: '4-Nerve',    component: Nerve },
  { label: '6-Movement', component: Movement },
  { label: '8-Heart',    component: Heart },
  { label: '10-Run',     component: Run },
  { label: '11-Victory', component: Victory },
]
