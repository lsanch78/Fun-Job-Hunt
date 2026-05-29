import { type ComponentType } from 'react'
import SelfDoubt, { label as label00 } from './00-SelfDoubt'

export interface SceneEntry {
  label: string
  component: ComponentType<{ onComplete: () => void }>
}

export const SCENES: SceneEntry[] = [
  { label: label00, component: SelfDoubt },
]
