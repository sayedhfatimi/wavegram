// Inline audio player for a Blob, managing the object URL lifecycle.

import { useEffect, useState } from 'react'

interface AudioPlayerProps {
  blob: Blob
  label: string
}

export function AudioPlayer({ blob, label }: AudioPlayerProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {url && (
        // biome-ignore lint/a11y/useMediaCaption: user audio has no captions
        <audio controls src={url} className="w-full" />
      )}
    </div>
  )
}
