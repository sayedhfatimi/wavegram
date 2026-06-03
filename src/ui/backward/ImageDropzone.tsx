// Faithful image picker for the Backward tab: a large tap target that works well on mobile
// (opens Photos/Files), plus drag-and-drop and clipboard paste on desktop. It does NOT use the
// `capture` attribute — forcing the camera would photograph a spectrogram, and a photo can't
// preserve the pixel-exact magnitudes the codec needs (it would fail the CRC). The hidden
// <input type="file" accept="image/png"> is kept in the DOM so the e2e harness can drive it.

import { type DragEvent, useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { fileFromDropEvent, fileFromPasteEvent } from '@/ui/lib/browser'

interface ImageDropzoneProps {
  onFile: (file: File | undefined) => void
  accept?: string
  disabled?: boolean
}

export function ImageDropzone({
  onFile,
  accept = 'image/png',
  disabled,
}: ImageDropzoneProps) {
  const [dragging, setDragging] = useState(false)

  const onDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault()
      setDragging(false)
      if (disabled) return
      onFile(fileFromDropEvent(e))
    },
    [onFile, disabled],
  )

  // Paste lands on the focused element / document, not the label, so listen at the document
  // level. We only act when the clipboard actually carries a file, leaving normal paste alone.
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
    <label
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0])}
        className="sr-only"
      />
      <span className="font-medium text-sm text-foreground">
        Tap to choose a Wavegram PNG
      </span>
      <span className="text-muted-foreground text-xs">
        or drag &amp; drop / paste — on mobile, pick it from your photos or files
      </span>
    </label>
  )
}
