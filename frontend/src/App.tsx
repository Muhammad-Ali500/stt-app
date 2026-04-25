import { useState } from 'react'
import { Mic, FileAudio, Github } from 'lucide-react'
import { LiveTranscriber } from './components/LiveTranscriber'
import { FileUploader } from './components/FileUploader'
import { cn } from './lib/utils'

type Tab = 'live' | 'file'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('file')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Mic className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold">Speech to Text</h1>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-2 p-1 bg-gray-900 rounded-lg mb-6 w-fit">
          <button
            onClick={() => setActiveTab('file')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'file'
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            <FileAudio className="w-4 h-4" />
            File Upload
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'live'
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            <Mic className="w-4 h-4" />
            Live Transcription
          </button>
        </div>

        {activeTab === 'file' ? <FileUploader /> : <LiveTranscriber />}
      </div>
    </div>
  )
}

export default App