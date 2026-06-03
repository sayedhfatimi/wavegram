import { Toaster } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BackwardTab } from '@/ui/backward/BackwardTab'
import { ForwardTab } from '@/ui/forward/ForwardTab'
import { useTheme } from '@/ui/lib/useTheme'
import { ThemeToggle } from '@/ui/ThemeToggle'

function App() {
  const { theme, toggle } = useTheme()

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="size-9 shrink-0" />
            <h1 className="text-3xl font-semibold tracking-tight">Wavegram</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Turn audio into a self-describing spectrogram image, and reconstruct audio
            from it — entirely in your browser.
          </p>
        </div>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>

      <Tabs defaultValue="forward">
        <TabsList>
          <TabsTrigger value="forward">Audio ➔ Image</TabsTrigger>
          <TabsTrigger value="backward">Image ➔ Audio</TabsTrigger>
        </TabsList>
        <TabsContent value="forward" className="mt-6">
          <ForwardTab />
        </TabsContent>
        <TabsContent value="backward" className="mt-6">
          <BackwardTab />
        </TabsContent>
      </Tabs>

      <footer className="mt-auto pt-6 text-xs text-muted-foreground">
        No server, no uploads — all processing runs locally. PNG only: pick a Wavegram
        from your photos or files, or drag-and-drop / paste it. (Photographing a
        spectrogram can't reconstruct the audio.)
      </footer>

      <Toaster theme={theme} richColors closeButton />
    </div>
  )
}

export default App
