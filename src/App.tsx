import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ForwardTab } from '@/ui/forward/ForwardTab'
import { BackwardTab } from '@/ui/backward/BackwardTab'

function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Wavegram</h1>
        <p className="text-sm text-muted-foreground">
          Turn audio into a self-describing spectrogram image, and reconstruct audio
          from it — entirely in your browser.
        </p>
      </header>

      <Tabs defaultValue="forward">
        <TabsList>
          <TabsTrigger value="forward">Audio → Image</TabsTrigger>
          <TabsTrigger value="backward">Image → Audio</TabsTrigger>
        </TabsList>
        <TabsContent value="forward" className="mt-6">
          <ForwardTab />
        </TabsContent>
        <TabsContent value="backward" className="mt-6">
          <BackwardTab />
        </TabsContent>
      </Tabs>

      <footer className="mt-auto pt-6 text-xs text-muted-foreground">
        No server, no uploads — all processing runs locally. PNG input only;
        camera capture is planned for a future version.
      </footer>
    </div>
  )
}

export default App
