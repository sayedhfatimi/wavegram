// Backward tab: Wavegram PNG -> reconstructed WAV (Griffin-Lim in a worker).

import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { extractMagnitude, readMetadata } from '@/core/backward'
import { fileToImageData } from '@/core/image/png'
import {
  GRIFFIN_LIM_PRESETS,
  type QualityPreset,
  type WavegramHeader,
} from '@/core/params'
import { AudioPlayer } from '@/ui/AudioPlayer'
import { downloadBlob, imageDataToRegion } from '@/ui/lib/browser'
import { useReconstruct } from '@/ui/lib/useReconstruct'

interface LoadedImage {
  rgba: Uint8ClampedArray
  width: number
  height: number
  magicValid: boolean
  crcValid: boolean
  header: WavegramHeader | null
  fileName: string
}

const PRESET_LABELS: Record<QualityPreset, string> = {
  fast: `Fast (${GRIFFIN_LIM_PRESETS.fast} iterations)`,
  default: `Default (${GRIFFIN_LIM_PRESETS.default} iterations)`,
  quality: `Quality (${GRIFFIN_LIM_PRESETS.quality} iterations)`,
}

export function BackwardTab() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [preset, setPreset] = useState<QualityPreset>('default')
  const { state, run, reset, cancel } = useReconstruct()
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Surface reconstruction failures as a toast in addition to the inline alert.
  useEffect(() => {
    if (state.status === 'error') toast.error(`Reconstruction failed: ${state.message}`)
  }, [state])

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setLoadError(null)
      reset()
      setImage(null)
      try {
        const img = await fileToImageData(file)
        const region = imageDataToRegion(img)
        const meta = readMetadata(region.rgba, region.width)
        setImage({
          rgba: region.rgba,
          width: region.width,
          height: region.height,
          magicValid: meta.magicValid,
          crcValid: meta.crcValid,
          header: meta.header,
          fileName: file.name,
        })
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e))
      }
    },
    [reset],
  )

  const canReconstruct = !!image && image.magicValid && image.crcValid && !!image.header

  const onReconstruct = useCallback(() => {
    if (!image?.header) return
    const magnitude = extractMagnitude(
      image.rgba,
      image.width,
      image.height,
      image.header,
    )
    run({
      magnitude,
      fftSize: image.header.fftSize,
      hopSize: image.header.hopSize,
      iterations: GRIFFIN_LIM_PRESETS[preset],
      sampleCount: image.header.sampleCount,
      sampleRate: image.header.sampleRate,
    })
  }, [image, preset, run])

  const outName = useMemo(
    () =>
      (image?.fileName ?? 'wavegram').replace(/\.[^.]+$/, '').replace(/\.wavegram$/, ''),
    [image],
  )

  const onDownload = useCallback(() => {
    if (state.status !== 'done') return
    downloadBlob(state.wav, `${outName}.reconstructed.wav`)
    toast.success('WAV downloaded')
  }, [state, outName])

  const onReset = useCallback(() => {
    cancel()
    setImage(null)
    setLoadError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [cancel])

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a Wavegram PNG</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground hover:file:opacity-90"
          />
          {loadError && (
            <Alert variant="destructive">
              <AlertTitle>Could not read image</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}
          {(image || loadError) && (
            <div>
              <Button variant="ghost" size="sm" onClick={onReset}>
                Start over
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardHeader>
            <CardTitle>2. Validation &amp; metadata</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-3">
              <Badge variant={image.magicValid ? 'default' : 'destructive'}>
                Magic {image.magicValid ? '✓' : '✗'}
              </Badge>
              <Badge variant={image.crcValid ? 'default' : 'destructive'}>
                CRC-16 {image.crcValid ? '✓' : '✗'}
              </Badge>
            </div>
            {!image.magicValid && (
              <Alert variant="destructive">
                <AlertTitle>Not a Wavegram image</AlertTitle>
                <AlertDescription>
                  No Wavegram metadata header was found. Make sure you're loading a PNG
                  produced by the Audio → Image tab.
                </AlertDescription>
              </Alert>
            )}
            {image.magicValid && !image.crcValid && (
              <Alert variant="destructive">
                <AlertTitle>Header checksum failed</AlertTitle>
                <AlertDescription>
                  The CRC check failed — this PNG was most likely re-compressed (e.g.
                  saved by another app or messaging service), edited, or resized.
                  Reconstruction needs the original, unmodified PNG.
                </AlertDescription>
              </Alert>
            )}
            {image.header && (
              <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
                <Meta label="Sample rate" value={`${image.header.sampleRate} Hz`} />
                <Meta label="FFT size" value={image.header.fftSize} />
                <Meta label="Hop size" value={image.header.hopSize} />
                <Meta label="Samples" value={image.header.sampleCount} />
                <Meta
                  label="Duration"
                  value={`${(image.header.sampleCount / image.header.sampleRate).toFixed(1)}s`}
                />
                <Meta
                  label="Precision"
                  value={image.header.precision === 1 ? '16-bit RGB' : '8-bit gray'}
                />
              </dl>
            )}
          </CardContent>
        </Card>
      )}

      {canReconstruct && (
        <Card>
          <CardHeader>
            <CardTitle>3. Reconstruct audio</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted-foreground">Griffin-Lim quality</span>
              <Select value={preset} onValueChange={(v) => setPreset(v as QualityPreset)}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRESET_LABELS) as QualityPreset[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PRESET_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={onReconstruct} disabled={state.status === 'running'}>
                {state.status === 'running' && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {state.status === 'running' ? 'Reconstructing…' : 'Reconstruct WAV'}
              </Button>
              {state.status === 'running' && (
                <Button variant="outline" onClick={cancel}>
                  Cancel
                </Button>
              )}
              {state.status === 'done' && (
                <Button variant="secondary" onClick={onDownload}>
                  Download WAV
                </Button>
              )}
            </div>

            {state.status === 'running' && (
              <Progress value={Math.round(state.progress * 100)} />
            )}
            {state.status === 'done' && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Spectral convergence error:{' '}
                  <span className="font-mono text-foreground">
                    {(state.error * 100).toFixed(2)}%
                  </span>{' '}
                  <span className="text-xs">
                    (lower is closer; phase is recovered, so it is never exactly 0)
                  </span>
                </p>
                <AudioPlayer blob={state.wav} label="Reconstructed audio" />
              </div>
            )}
            {state.status === 'error' && (
              <Alert variant="destructive">
                <AlertTitle>Reconstruction failed</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  )
}
