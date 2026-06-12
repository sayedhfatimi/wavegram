// Shared file picker for both tabs. A large dashed drop area with an explicit button that triggers
// a hidden <input> via ref — the most reliable way to open the picker on iOS Safari, which is
// flaky about label-implicit activation of a clipped input. Drag-and-drop and clipboard paste
// remain for desktop. It does NOT use the `capture` attribute (forcing the camera would photograph
// a spectrogram, which can't preserve the pixel-exact magnitudes the codec needs). The hidden
// <input> stays in the DOM so the e2e harness can drive it with setInputFiles.

import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fileFromDropEvent, fileFromPasteEvent } from '@/ui/lib/browser'

interface FileDropzoneProps {
  onFile: (file: File | undefined) => void
  accept: string
  title: string
  hint: string
  disabled?: boolean
}

export function FileDropzone({
  onFile,
  accept,
  title,
  hint,
  disabled,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      if (disabled) return
      onFile(fileFromDropEvent(e))
    },
    [onFile, disabled],
  )

  // Paste lands on the focused element / document, not this node, so listen at the document level.
  // We only act when the clipboard actually carries a file, leaving normal paste alone.
  useEffect(() => {
    if (disabled) return
    const handler = (e: ClipboardEvent) => {
      const file = fileFromPasteEvent(e)
      if (file) onFile(file)
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [onFile, disabled])

  return (
    // Drag-and-drop is a desktop-only progressive enhancement; the keyboard/AT-accessible action
    // is the Button below (which opens the native picker). The drag handlers add no behavior that
    // isn't already reachable, so a static container is appropriate here.
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-drop augments the accessible Button
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-input',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0])}
        className="sr-only"
      />
      <Button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {title}
      </Button>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </div>
  )
}
