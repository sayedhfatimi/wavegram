// Inline audio player for a Blob: a themed wavesurfer.js waveform with transport controls.
//
// Adapted from the vocasync dashboard WaveformPlayer pattern, with one difference: the source
// is a local Blob (via an object URL) rather than a remote bucket stream, so wavesurfer decodes
// it instantly and renders real peaks — no placeholder peaks needed. Waveform colours are pulled
// from the app's CSS theme tokens so it matches light/dark and the rest of the page.

import { Loader2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

interface AudioPlayerProps {
  blob: Blob
  label: string
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')
  return `${minutes}:${secs}`
}

/** Read a CSS custom property off an element, falling back when unset. */
function readCssVar(el: HTMLElement, property: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(property).trim() || fallback
}

export function AudioPlayer({ blob, label }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  // Build (and tear down) the wavesurfer instance for the current blob.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setIsReady(false)
    setIsPlaying(false)
    setCurrentTime(0)

    const objectUrl = URL.createObjectURL(blob)
    // The inline CSS vars on the container (see render) resolve against the theme tokens; read
    // them back so canvas gets concrete colours that track light/dark.
    const waveColor = readCssVar(container, '--waveform-wave', 'rgba(148,163,184,0.45)')
    const progressColor = readCssVar(container, '--waveform-progress', '#444')
    const cursorColor = readCssVar(container, '--waveform-cursor', progressColor)

    const ws = WaveSurfer.create({
      container,
      url: objectUrl,
      height: 56,
      waveColor,
      progressColor,
      cursorColor,
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true, // fill the height even for the quiet reconstructed audio
      dragToSeek: true,
      hideScrollbar: true,
      plugins: [
        Hover.create({
          lineColor: progressColor,
          lineWidth: 1,
          labelBackground: 'rgba(0,0,0,0.75)',
          labelColor: '#fff',
          labelSize: '11px',
        }),
      ],
    })
    wsRef.current = ws

    ws.on('ready', () => {
      setIsReady(true)
      setDuration(ws.getDuration())
    })
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))
    ws.on('timeupdate', (time) => setCurrentTime(time))

    return () => {
      ws.destroy()
      wsRef.current = null
      URL.revokeObjectURL(objectUrl)
    }
  }, [blob])

  // Apply volume/mute to the instance — also re-applies once a new blob becomes ready.
  useEffect(() => {
    if (isReady) wsRef.current?.setVolume(isMuted ? 0 : volume)
  }, [volume, isMuted, isReady])

  const togglePlay = useCallback(() => {
    wsRef.current?.playPause()
  }, [])

  const toggleMute = useCallback(() => setIsMuted((m) => !m), [])

  const onVolumeChange = useCallback((values: number[]) => {
    const next = (values[0] ?? 0) / 100
    setVolume(next)
    if (next > 0) setIsMuted(false)
  }, [])

  const displayVolume = isMuted ? 0 : Math.round(volume * 100)

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {formatTime(currentTime)} / {isReady ? formatTime(duration) : '--:--'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          onClick={togglePlay}
          disabled={!isReady}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="size-11 shrink-0 rounded-full"
        >
          {isPlaying ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
        </Button>

        <div className="relative min-w-0 flex-1">
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          <div
            ref={containerRef}
            className="w-full transition-opacity"
            style={
              {
                opacity: isReady ? 1 : 0.3,
                // Unplayed bars: a subtle neutral grey (--muted-foreground). Played + cursor use
                // the brand violet (--primary) — now a real colour in both themes, so the played
                // portion pops by hue against the grey rather than relying on lightness alone.
                '--waveform-wave':
                  'color-mix(in oklab, var(--muted-foreground) 55%, transparent)',
                '--waveform-progress': 'var(--primary)',
                '--waveform-cursor': 'var(--primary)',
              } as CSSProperties
            }
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggleMute}
          disabled={!isReady}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="rounded-full"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </Button>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[displayVolume]}
          onValueChange={onVolumeChange}
          disabled={!isReady}
          className="w-24"
          aria-label="Volume"
        />
      </div>
    </div>
  )
}
