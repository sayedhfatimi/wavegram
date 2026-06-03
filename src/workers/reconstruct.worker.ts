// Web Worker: runs the expensive Griffin-Lim phase recovery off the main thread.
//
// Receives the recovered magnitude matrix + reconstruction params, posts progress per iteration,
// then posts the final WAV ArrayBuffer (transferred, not copied).

/// <reference lib="webworker" />
import { griffinLim } from '../core/audio/griffinlim'
import { stftMagnitude } from '../core/audio/stft'
import { encodeWav } from '../core/audio/wav'
import { spectralError } from '../core/metrics'

declare const self: DedicatedWorkerGlobalScope

export interface ReconstructRequest {
  magnitude: Float32Array[]
  fftSize: number
  hopSize: number
  iterations: number
  sampleCount: number
  sampleRate: number
  momentum?: number
  initialPhase?: Float32Array[]
}

export type ReconstructResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; wav: ArrayBuffer; error: number }
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
      req.momentum ?? 0,
      req.initialPhase,
    )
    // spectral-convergence error between the target magnitude and the
    // reconstruction's magnitude — a fidelity readout for the UI.
    const error = spectralError(
      req.magnitude,
      stftMagnitude(signal, req.fftSize, req.hopSize),
    )
    const wav = encodeWav(signal, req.sampleRate)
    const msg: ReconstructResponse = { type: 'done', wav, error }
    self.postMessage(msg, [wav])
  } catch (err) {
    const msg: ReconstructResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(msg)
  }
}
