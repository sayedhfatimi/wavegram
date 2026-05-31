// Hook that drives the Griffin-Lim worker and exposes progress + the resulting WAV.

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ReconstructRequest,
  ReconstructResponse,
} from '@/workers/reconstruct.worker'

export type ReconstructState =
  | { status: 'idle' }
  | { status: 'running'; progress: number }
  | { status: 'done'; wav: Blob }
  | { status: 'error'; message: string }

export function useReconstruct() {
  const workerRef = useRef<Worker | null>(null)
  const [state, setState] = useState<ReconstructState>({ status: 'idle' })

  // tear down any worker on unmount
  useEffect(() => {
    return () => workerRef.current?.terminate()
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  const run = useCallback((req: ReconstructRequest) => {
    workerRef.current?.terminate()
    const worker = new Worker(
      new URL('@/workers/reconstruct.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker
    setState({ status: 'running', progress: 0 })

    worker.onmessage = (e: MessageEvent<ReconstructResponse>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setState({ status: 'running', progress: msg.done / msg.total })
      } else if (msg.type === 'done') {
        setState({ status: 'done', wav: new Blob([msg.wav], { type: 'audio/wav' }) })
        worker.terminate()
        workerRef.current = null
      } else {
        setState({ status: 'error', message: msg.message })
        worker.terminate()
        workerRef.current = null
      }
    }
    worker.onerror = (e) => {
      setState({ status: 'error', message: e.message })
    }
    worker.postMessage(req)
  }, [])

  return { state, run, reset }
}
