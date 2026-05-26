import '@testing-library/jest-dom'

// Polyfill TextEncoder / TextDecoder for Jest (jsdom does not expose these on global)
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder as typeof global.TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder

// Mock Web Audio API (not available in jsdom)
class MockAudioContext {
  createBuffer() {
    return {
      getChannelData: () => new Float32Array(0),
      duration: 0,
      length: 0,
      numberOfChannels: 1,
      sampleRate: 44100,
    }
  }
  createBufferSource() {
    return {
      buffer: null,
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      disconnect: jest.fn(),
      onended: null,
    }
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      connect: jest.fn(),
      disconnect: jest.fn(),
    }
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 440, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      disconnect: jest.fn(),
    }
  }
  createBiquadFilter() {
    return {
      type: 'bandpass',
      frequency: { value: 1000, setValueAtTime: jest.fn() },
      Q: { value: 1 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    }
  }
  createDynamicsCompressor() {
    return {
      threshold: { value: -24 },
      knee: { value: 30 },
      ratio: { value: 12 },
      attack: { value: 0.003 },
      release: { value: 0.25 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    }
  }
  get destination() { return {} }
  get currentTime() { return 0 }
  get sampleRate() { return 44100 }
  close() { return Promise.resolve() }
}

Object.defineProperty(window, 'AudioContext', { writable: true, value: MockAudioContext })
Object.defineProperty(window, 'webkitAudioContext', { writable: true, value: MockAudioContext })
