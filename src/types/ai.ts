export type AiProvider = 'proxy' | 'openai' | 'anthropic'

export type AiPhase = 'idle' | 'generating' | 'ready'


export interface RunParams {
  system: string
  prompt: string
  onComplete: (result: string) => void
  onError?: (message: string) => void
  model?: string
}
