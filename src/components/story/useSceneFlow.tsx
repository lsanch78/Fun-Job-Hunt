import { useState } from 'react'
import DialogueScene from './DialogueScene'
import DialogueInputScene from './DialogueInputScene'
import DialogueChoiceScene from './DialogueChoiceScene'
import type { DialogueLine, DialogueSceneProps } from './DialogueScene'
import { supabase } from '@/lib/supabase'
import { setStoryInput } from '@/services/storyInputService'

type LinesResolver = DialogueLine[] | ((inputs: string[]) => DialogueLine[])

interface LinesStep {
  type: 'lines'
  lines: LinesResolver
  onLineAdvance?: DialogueSceneProps['onLineAdvance']
  fadeIn?: boolean
}

interface InputStep {
  type: 'input'
  speaker?: string
  prompt: string
  placeholder?: string
  maxLength?: number
  /** If set, persists the value to storyInputs[index] in localStorage + DB */
  storyInputIndex?: number
  /** If set, also writes the value to auth user_metadata[key] */
  userMetaKey?: string
}

interface ChoiceStep {
  type: 'choice'
  speaker?: string
  prompt: string | ((inputs: string[]) => string)
  options: string[]
  /** If set, persists the chosen value to storyInputs[index] in localStorage + DB */
  storyInputIndex?: number
}

export type SceneStep = LinesStep | InputStep | ChoiceStep

interface SceneFlowOptions {
  weather?: DialogueSceneProps['weather']
}

export function useSceneFlow(steps: SceneStep[], options: SceneFlowOptions = {}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [inputs, setInputs] = useState<string[]>([])

  function advance() {
    setStepIndex(i => i + 1)
  }

  async function handleInput(value: string, step: InputStep) {
    const nextInputs = [...inputs, value]
    setInputs(nextInputs)

    if (step.storyInputIndex !== undefined || step.userMetaKey) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        if (step.storyInputIndex !== undefined) {
          await setStoryInput(user.id, step.storyInputIndex, value)
        }
        if (step.userMetaKey) {
          await supabase.auth.updateUser({ data: { [step.userMetaKey]: value } })
        }
      }
    }

    advance()
  }

  async function handleChoice(value: string, step: ChoiceStep) {
    setInputs(prev => [...prev, value])

    if (step.storyInputIndex !== undefined) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await setStoryInput(user.id, step.storyInputIndex, value)
    }

    advance()
  }

  function node(onComplete: () => void): React.ReactNode {
    const step = steps[stepIndex]
    if (!step) { onComplete(); return null }

    if (step.type === 'input') {
      return (
        <DialogueInputScene
          key={stepIndex}
          speaker={step.speaker}
          prompt={step.prompt}
          placeholder={step.placeholder}
          maxLength={step.maxLength}
          weather={options.weather}
          onSubmit={value => handleInput(value, step)}
        />
      )
    }

    if (step.type === 'choice') {
      const resolvedPrompt = typeof step.prompt === 'function' ? step.prompt(inputs) : step.prompt
      return (
        <DialogueChoiceScene
          key={stepIndex}
          speaker={step.speaker}
          prompt={resolvedPrompt}
          options={step.options}
          weather={options.weather}
          onSubmit={value => handleChoice(value, step)}
        />
      )
    }

    const resolvedLines = typeof step.lines === 'function' ? step.lines(inputs) : step.lines
    const isLast = stepIndex === steps.length - 1

    return (
      <DialogueScene
        key={stepIndex}
        lines={resolvedLines}
        onComplete={isLast ? onComplete : advance}
        onLineAdvance={step.onLineAdvance}
        weather={options.weather}
        fadeIn={step.fadeIn}
      />
    )
  }

  return { node, inputs, stepIndex }
}
