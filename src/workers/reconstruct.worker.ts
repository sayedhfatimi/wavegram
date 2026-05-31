// Web Worker: runs the expensive Griffin-Lim phase recovery off the main thread.
//
// Receives the recovered magnitude matrix + reconstruction params, posts progress per iteration,
// then posts the final WAV ArrayBuffer (transferred, not copied).

/// <reference lib="webworker" />
import { griffinLim } from '../core/audio/griffinlim'
import { encodeWav } from '../core/audio/wav'

declare const self: DedicatedWorkerGlobalScope

export interface ReconstructRequest {
  magnitude: Float32Array[]
  fftSize: number
  hopSize: number
  iterations: number
  sampleCount: number
  sampleRate: number
}

export type ReconstructResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; wav: ArrayBuffer }
  | { type: 'error'; message: string }

self.onmessage = (e: MessageEvent<ReconstructRequest>) => {
  const req = e.data
  try {
    const signal = griffinLim(
      req.magnitude,
      req.fftSize,
      req.hopSize,
      req.iterations,
      req.sampleCount,
      (done, total) => {
        const msg: ReconstructResponse = { type: 'progress', done, total }
        self.postMessage(msg)
      },
    )
    const wav = encodeWav(signal, req.sampleRate)
    const msg: ReconstructResponse = { type: 'done', wav }
    self.postMessage(msg, [wav])
  } catch (err) {
    const msg: ReconstructResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(msg)
  }
}
