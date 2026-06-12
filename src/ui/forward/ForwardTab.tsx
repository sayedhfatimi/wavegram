// Forward tab: audio file -> Wavegram PNG.

import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type DecodedAudio, decodeAudioFile } from '@/core/audio/decode'
import { stftMagnitude } from '@/core/audio/stft'
import { encodeWav } from '@/core/audio/wav'
import { encodeToImage } from '@/core/forward'
import { imageDataToPngBlob } from '@/core/image/png'
import { forwardLogScale } from '@/core/log'
import { DEFAULTS, type Precision } from '@/core/params'
import { AudioPlayer } from '@/ui/AudioPlayer'
import { RecordButton } from '@/ui/forward/RecordButton'
import { downloadBlob, regionToImageData } from '@/ui/lib/browser'
import { FileDropzone } from '@/ui/lib/FileDropzone'
import { magnitudeToFalseColorRegion } from '@/ui/lib/spectrogramView'

const FFT_OPTIONS = [256, 512, 1024, 2048]
const PRECISION_OPTIONS: { value: Precision; label: string }[] = [
  { value: 1, label: '16-bit (RGB packed) — best quality' },
  { value: 0, label: '8-bit (grayscale) — spec-literal' },
]

type PreviewMode = 'encoded' | 'falsecolor'

interface Views {
  encoded: ImageData
  falseColor: ImageData
}

export function ForwardTab() {
  const [audio, setAudio] = useState<DecodedAudio | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [fftSize, setFftSize] = useState<number>(DEFAULTS.fftSize)
  const [precision, setPrecision] = useState<Precision>(DEFAULTS.precision)
  const [storePhase, setStorePhase] = useState(true)
  const [pngBlob, setPngBlob] = useState<Blob | null>(null)
  const [views, setViews] = useState<Views | null>(null)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('falsecolor')
  const [decoding, setDecoding] = useState(false)
  const [encoding, setEncoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Bumping this key remounts the dropzone, clearing its file input on reset.
  const [pickerKey, setPickerKey] = useState(0)

  const hopSize = fftSize / 2

  const originalAudio = useMemo(
    () =>
      audio
        ? new Blob([encodeWav(audio.samples, audio.sampleRate)], { type: 'audio/wav' })
        : null,
    [audio],
  )

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setPngBlob(null)
    setViews(null)
    setDecoding(true)
    try {
      const decoded = await decodeAudioFile(file)
      setAudio(decoded)
      setFileName(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setAudio(null)
    } finally {
      setDecoding(false)
    }
  }, [])

  const onProcess = useCallback(async () => {
    if (!audio) return
    setError(null)
    setEncoding(true)
    try {
      const region = encodeToImage(
        audio.samples,
        audio.sampleRate,
        audio.sampleCount,
        fftSize,
        hopSize,
        precision,
        precision === 1 && storePhase,
      )
      const encoded = regionToImageData(region)
      // recompute the [0,1] magnitude matrix for a legible false-color preview
      const scaled = forwardLogScale(stftMagnitude(audio.samples, fftSize, hopSize))
      const falseColor = regionToImageData(magnitudeToFalseColorRegion(scaled))
      setViews({ encoded, falseColor })
      setPngBlob(await imageDataToPngBlob(encoded))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEncoding(false)
    }
  }, [audio, fftSize, hopSize, precision, storePhase])

  // Draw the selected preview onto the canvas whenever it or the view changes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !views) return
    const img = previewMode === 'encoded' ? views.encoded : views.falseColor
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')?.putImageData(img, 0, 0)
  }, [views, previewMode])

  const outName = fileName.replace(/\.[^.]+$/, '') || 'wavegram'
  const hasState = !!audio || !!pngBlob || !!error

  const onReset = useCallback(() => {
    setAudio(null)
    setFileName('')
    setPngBlob(null)
    setViews(null)
    setError(null)
    setDecoding(false)
    setEncoding(false)
    setPickerKey((k) => k + 1)
  }, [])

  const onDownload = useCallback(() => {
    if (!pngBlob) return
    downloadBlob(pngBlob, `${outName}.wavegram.png`)
    toast.success('PNG downloaded')
  }, [pngBlob, outName])

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose an audio file</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FileDropzone
            key={pickerKey}
            onFile={onFile}
            accept="audio/*,.m4a,.aac,.mp3,.wav,.ogg,.flac"
            title="Choose an audio file"
            hint="or drag & drop — or record below"
            disabled={decoding}
          />
          <RecordButton onFile={onFile} disabled={decoding || encoding} />
          {decoding && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Decoding audio…
            </p>
          )}
          {audio && !decoding && (
            <p className="text-sm text-muted-foreground">
              {fileName} — {audio.durationSec.toFixed(1)}s, {audio.sampleRate} Hz mono
            </p>
          )}
          {originalAudio && !decoding && (
            <AudioPlayer blob={originalAudio} label="Original (normalized mono input)" />
          )}
          {audio?.capped && (
            <Alert variant="destructive">
              <AlertTitle>Trimmed to {DEFAULTS.maxDurationSec}s</AlertTitle>
              <AlertDescription>
                Audio longer than {DEFAULTS.maxDurationSec} seconds is capped (v1 limit).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Parameters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">FFT window size</span>
            <Select value={String(fftSize)} onValueChange={(v) => setFftSize(Number(v))}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FFT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Hop size (auto = window / 2)</span>
            <span className="flex h-9 items-center font-mono">{hopSize}</span>
          </div>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Magnitude precision</span>
            <Select
              value={String(precision)}
              onValueChange={(v) => setPrecision(Number(v) as Precision)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRECISION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex max-w-72 flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Phase seed</span>
            <span className="flex h-9 items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={precision === 1 && storePhase}
                disabled={precision !== 1}
                onChange={(e) => setStorePhase(e.target.checked)}
              />
              <span className={precision !== 1 ? 'text-muted-foreground' : ''}>
                {precision === 1
                  ? 'Store phase for better reconstruction'
                  : 'Requires 16-bit precision'}
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={onProcess} disabled={!audio || decoding || encoding}>
          {encoding && <Loader2 className="size-4 animate-spin" />}
          {encoding ? 'Generating…' : 'Generate Wavegram'}
        </Button>
        {pngBlob && (
          <Button variant="secondary" onClick={onDownload}>
            Download PNG
          </Button>
        )}
        {hasState && (
          <Button variant="ghost" onClick={onReset} disabled={decoding || encoding}>
            Start over
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className={views ? '' : 'hidden'}>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={previewMode === 'falsecolor' ? 'default' : 'outline'}
              onClick={() => setPreviewMode('falsecolor')}
            >
              False color
            </Button>
            <Button
              size="sm"
              variant={previewMode === 'encoded' ? 'default' : 'outline'}
              onClick={() => setPreviewMode('encoded')}
            >
              Encoded image
            </Button>
          </div>
          <canvas
            ref={canvasRef}
            className="max-w-full border bg-black [image-rendering:pixelated]"
          />
          <p className="text-xs text-muted-foreground">
            {previewMode === 'falsecolor'
              ? 'A readable viridis rendering of the magnitude spectrogram. The downloaded PNG is the encoded image.'
              : 'The literal PNG that gets downloaded — magnitude packed across colour channels.'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
