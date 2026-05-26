import { fetchModels, streamCompletion } from '@/services/ollamaService'

// ---------- Helpers ----------

/**
 * Build a mock response body whose getReader().read() method returns the
 * provided string chunks one-by-one, without needing ReadableStream.
 */
function makeMockBody(chunks: string[]) {
  let i = 0
  const encoder = new (require('util').TextEncoder)() as TextEncoder
  return {
    getReader() {
      return {
        read(): Promise<{ done: boolean; value: Uint8Array | undefined }> {
          if (i < chunks.length) {
            return Promise.resolve({ done: false, value: encoder.encode(chunks[i++]) })
          }
          return Promise.resolve({ done: true, value: undefined })
        },
      }
    },
  }
}

function encodeLines(...lines: string[]): string {
  return lines.join('\n') + '\n'
}

beforeEach(() => {
  jest.restoreAllMocks()
})

// ---------- fetchModels ----------

describe('fetchModels', () => {
  it('returns connected status and model names on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3' }, { name: 'mistral' }] }),
    }) as jest.Mock

    const result = await fetchModels()

    expect(result.status).toBe('connected')
    expect(result.models).toEqual(['llama3', 'mistral'])
  })

  it('handles empty models array', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }),
    }) as jest.Mock

    const result = await fetchModels()

    expect(result.status).toBe('connected')
    expect(result.models).toEqual([])
  })

  it('handles missing models field', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as jest.Mock

    const result = await fetchModels()

    expect(result.status).toBe('connected')
    expect(result.models).toEqual([])
  })

  it('returns not_connected when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as jest.Mock

    const result = await fetchModels()

    expect(result).toEqual({ status: 'not_connected', models: [] })
  })

  it('returns not_connected on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure')) as jest.Mock

    const result = await fetchModels()

    expect(result).toEqual({ status: 'not_connected', models: [] })
  })

  it('returns not_connected when request is aborted (timeout)', async () => {
    global.fetch = jest.fn().mockRejectedValue(
      Object.assign(new Error('Aborted'), { name: 'AbortError' }),
    ) as jest.Mock

    const result = await fetchModels()

    expect(result).toEqual({ status: 'not_connected', models: [] })
  })
})

// ---------- streamCompletion ----------

describe('streamCompletion', () => {
  const baseParams = {
    model: 'llama3',
    system: 'You are helpful.',
    prompt: 'Hello',
    onToken: jest.fn(),
    onDone: jest.fn(),
    onError: jest.fn(),
  }

  beforeEach(() => {
    baseParams.onToken = jest.fn()
    baseParams.onDone = jest.fn()
    baseParams.onError = jest.fn()
  })

  it('calls onToken for each response token', async () => {
    const lines = [
      JSON.stringify({ response: 'Hello', done: false }),
      JSON.stringify({ response: ' world', done: false }),
      JSON.stringify({ response: '!', done: true }),
    ]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeMockBody([encodeLines(...lines)]),
    }) as jest.Mock

    await streamCompletion(baseParams)

    expect(baseParams.onToken).toHaveBeenCalledTimes(3)
    expect(baseParams.onToken).toHaveBeenNthCalledWith(1, 'Hello')
    expect(baseParams.onToken).toHaveBeenNthCalledWith(2, ' world')
    expect(baseParams.onToken).toHaveBeenNthCalledWith(3, '!')
  })

  it('calls onDone when done flag is true', async () => {
    const lines = [
      JSON.stringify({ response: 'Hi', done: false }),
      JSON.stringify({ response: '', done: true }),
    ]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeMockBody([encodeLines(...lines)]),
    }) as jest.Mock

    await streamCompletion(baseParams)

    expect(baseParams.onDone).toHaveBeenCalledTimes(1)
  })

  it('calls onDone when stream ends naturally', async () => {
    const lines = [JSON.stringify({ response: 'Hi', done: false })]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeMockBody([encodeLines(...lines)]),
    }) as jest.Mock

    await streamCompletion(baseParams)

    expect(baseParams.onDone).toHaveBeenCalled()
  })

  it('calls onError on HTTP error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      body: null,
    }) as jest.Mock

    await streamCompletion(baseParams)

    expect(baseParams.onError).toHaveBeenCalledWith('HTTP 404')
    expect(baseParams.onDone).not.toHaveBeenCalled()
  })

  it('calls onError on null body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      body: null,
    }) as jest.Mock

    await streamCompletion(baseParams)

    expect(baseParams.onError).toHaveBeenCalledWith('HTTP 503')
  })

  it('calls onError on fetch exception', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connection refused')) as jest.Mock

    await streamCompletion(baseParams)

    expect(baseParams.onError).toHaveBeenCalledWith('connection refused')
  })

  it('returns silently when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    global.fetch = jest.fn().mockRejectedValue(
      Object.assign(new Error('Aborted'), { name: 'AbortError' }),
    ) as jest.Mock

    await streamCompletion({ ...baseParams, signal: controller.signal })

    expect(baseParams.onError).not.toHaveBeenCalled()
    expect(baseParams.onDone).not.toHaveBeenCalled()
  })

  it('skips malformed JSON lines and continues', async () => {
    const lines = [
      'not-valid-json{{{',
      JSON.stringify({ response: 'ok', done: true }),
    ]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeMockBody([encodeLines(...lines)]),
    }) as jest.Mock

    await streamCompletion(baseParams)

    // malformed line is skipped, valid line processed
    expect(baseParams.onToken).toHaveBeenCalledWith('ok')
    expect(baseParams.onDone).toHaveBeenCalled()
  })

  it('sends correct POST body to Ollama', async () => {
    const lines = [JSON.stringify({ response: 'Hi', done: true })]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeMockBody([encodeLines(...lines)]),
    }) as jest.Mock

    await streamCompletion({ ...baseParams, model: 'mistral', system: 'sys', prompt: 'pmt' })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'mistral', system: 'sys', prompt: 'pmt', stream: true }),
      }),
    )
  })
})
