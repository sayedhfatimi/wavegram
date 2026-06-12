// Record audio in-browser for the Forward tab, so users (especially on iOS, which has no
// file-picker voice recorder) never leave the page to capture a memo. Renders nothing when the
// browser can't record. Built on useAudioRecorder, which hands the captured File to onFile.

import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAudioRecorder } from '@/ui/lib/useAudioRecorder'

interface RecordButtonProps {
  onFile: (file: File | undefined) => void
  disabled?: boolean
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RecordButton({ onFile, disabled }: RecordButtonProps) {
  const { status, elapsedSec, start, stop } = useAudioRecorder(onFile)

  if (status === 'unsupported') return null

  if (status === 'recording') {
    return (
      <div className="flex items-center gap-3">
        <Button type="button" variant="destructive" onClick={stop}>
          <Square className="size-4" />
          Stop recording
        </Button>
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatElapsed(elapsedSec)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" disabled={disabled} onClick={start}>
        <Mic className="size-4" />
        Record audio
      </Button>
      {status === 'denied' && (
        <span className="text-destructive text-xs">
          Microphone access was blocked. Allow it in your browser settings to record.
        </span>
      )}
    </div>
  )
}
