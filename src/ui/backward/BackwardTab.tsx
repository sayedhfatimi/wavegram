// Backward tab: Wavegram PNG -> reconstructed WAV (Griffin-Lim in a worker).

import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Slider } from '@/components/ui/slider'
import { extractMagnitude, extractPhase, readMetadata } from '@/core/backward'
import { fileToImageData } from '@/core/image/png'
import {
  GRIFFIN_LIM_PRESETS,
  type QualityPreset,
  type WavegramHeader,
} from '@/core/params'
import { AudioPlayer } from '@/ui/AudioPlayer'
import { downloadBlob, imageDataToRegion } from '@/ui/lib/browser'
import { FileDropzone } from '@/ui/lib/FileDropzone'
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

type QualityMode = QualityPreset | 'custom'

const PRESET_LABELS: Record<QualityPreset, string> = {
  fast: `Fast (${GRIFFIN_LIM_PRESETS.fast.iterations} iterations)`,
  default: `Default (${GRIFFIN_LIM_PRESETS.default.iterations} iterations)`,
  quality: `Quality (${GRIFFIN_LIM_PRESETS.quality.iterations} iterations)`,
  accelerated: `Accelerated (fast Griffin-Lim, ${GRIFFIN_LIM_PRESETS.accelerated.iterations} iterations)`,
}

const MODE_LABELS: Record<QualityMode, string> = {
  ...PRESET_LABELS,
  custom: 'Custom…',
}

export function BackwardTab() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<QualityMode>('default')
  const [customIters, setCustomIters] = useState(50)
  const { state, run, reset, cancel } = useReconstruct()
  // Bumping this key remounts the dropzone, which clears its file input on "Start over".
  const [pickerKey, setPickerKey] = useState(0)

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
    const settings =
      mode === 'custom'
        ? { iterations: customIters, momentum: 0 }
        : GRIFFIN_LIM_PRESETS[mode]
    try {
      const magnitude = extractMagnitude(
        image.rgba,
        image.width,
        image.height,
        image.header,
      )
      const initialPhase =
        extractPhase(image.rgba, image.width, image.height, image.header) ?? undefined
      run({
        magnitude,
        fftSize: image.header.fftSize,
        hopSize: image.header.hopSize,
        iterations: settings.iterations,
        momentum: settings.momentum,
        sampleCount: image.header.sampleCount,
        sampleRate: image.header.sampleRate,
        initialPhase,
      })
    } catch (e) {
      // Surface extraction failures (e.g. a header inconsistent with the image) instead of
      // letting them throw uncaught and leave the button a silent no-op.
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(`Reconstruction failed: ${msg}`)
      setLoadError(msg)
    }
  }, [image, mode, customIters, run])

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
    setPickerKey((k) => k + 1)
  }, [cancel])

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a Wavegram PNG</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FileDropzone
            key={pickerKey}
            onFile={onFile}
            accept="image/*"
            title="Choose a Wavegram PNG"
            hint="or drag & drop / paste — on mobile, pick from Photos or Files"
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
                  produced by the Audio ➔ Image tab.
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
                <Meta label="Phase seed" value={image.header.hasPhase ? 'Yes' : 'No'} />
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
              <Select value={mode} onValueChange={(v) => setMode(v as QualityMode)}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABELS) as QualityMode[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {MODE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {mode === 'custom' && (
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-muted-foreground">
                  Iterations: <span className="font-mono">{customIters}</span>
                </span>
                <Slider
                  className="max-w-80"
                  min={5}
                  max={200}
                  step={1}
                  value={[customIters]}
                  onValueChange={([v]) => setCustomIters(v)}
                />
              </label>
            )}

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
