// In-browser audio recorder built on MediaRecorder. Lets users capture audio without leaving the
// page — critical on iOS, which offers no file-picker "voice recorder" and stores Voice Memos as
// .m4a that the picker tends to hide. We own the resulting Blob, so it's always decodable by
// decodeAudioFile. The pure mime helpers are unit-tested; the hook itself is exercised in the app.

import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULTS } from '@/core/params'

// iOS Safari yields audio/mp4 (AAC); Chromium yields webm/opus. decodeAudioData handles both.
const MIME_PREFERENCE = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']

/** First MediaRecorder mime from our preference order that the browser supports, or '' to default. */
export function pickRecorderMimeType(isSupported: (type: string) => boolean): string {
  return MIME_PREFERENCE.find((t) => isSupported(t)) ?? ''
}

/** File extension for a recorded blob's mime type. */
export function recorderFileExtension(mimeType: string): string {
  return mimeType.startsWith('audio/mp4') ? '.m4a' : '.webm'
}

export type RecorderStatus = 'idle' | 'recording' | 'unsupported' | 'denied'

/** Whether this browser can record at all (HTTPS/localhost + MediaRecorder support assumed). */
function recorderSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  )
}

/**
 * Record audio in-page and hand the captured File to `onFile` on stop. Auto-stops at `maxSec`
 * (matching the codec's duration cap). Returns the current status, elapsed seconds, and controls.
 */
export function useAudioRecorder(
  onFile: (file: File) => void,
  maxSec = DEFAULTS.maxDurationSec,
) {
  const [status, setStatus] = useState<RecorderStatus>(() =>
    recorderSupported() ? 'idle' : 'unsupported',
  )
  const [elapsedSec, setElapsedSec] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    for (const t of streamRef.current?.getTracks() ?? []) t.stop()
    streamRef.current = null
    recorderRef.current = null
  }, [])

  // Tear down the stream/timer if the component unmounts mid-recording.
  useEffect(() => cleanup, [cleanup])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const start = useCallback(async () => {
    if (!recorderSupported()) {
      setStatus('unsupported')
      return
    }
    if (recorderRef.current) return // already recording
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setStatus('denied')
      return
    }
    streamRef.current = stream
    const mime = pickRecorderMimeType((t) => MediaRecorder.isTypeSupported(t))
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const type = mime || chunksRef.current[0]?.type || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type })
      cleanup()
      setStatus('idle')
      setElapsedSec(0)
      if (blob.size > 0) {
        onFile(new File([blob], `recording${recorderFileExtension(type)}`, { type }))
      }
    }

    setElapsedSec(0)
    setStatus('recording')
    recorder.start()

    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000)
      setElapsedSec(secs)
      if (secs >= maxSec) stop()
    }, 250)
  }, [onFile, maxSec, cleanup, stop])

  return { status, elapsedSec, start, stop }
}
