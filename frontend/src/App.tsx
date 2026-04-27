import { useState } from 'react'
import { Mic, Upload, Bot, FileAudio } from 'lucide-react'
import { LiveTranscriber } from './components/LiveTranscriber'
import { FileUploader } from './components/FileUploader'
import { VoiceChat } from './components/VoiceChat'

function App() {
  const [mode, setMode] = useState<'live' | 'file' | 'voice'>('voice')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold">Voice AI Assistant</h1>
          </div>
          <div className="text-sm text-gray-500">
            STT + LLM + TTS
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-2 p-1 bg-gray-900 rounded-lg w-fit mb-6">
          <button
            onClick={() => setMode('voice')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'voice'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bot className="w-4 h-4" />
            Voice AI
          </button>
          <button
            onClick={() => setMode('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'live'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4" />
            Live STT
          </button>
          <button
            onClick={() => setMode('file')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'file'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            File Upload
          </button>
        </div>

        {mode === 'voice' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-900 rounded-lg overflow-hidden">
              <VoiceChat />
            </div>
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-500" />
                AI Conversation
              </h2>
              <div className="h-96 flex items-center justify-center text-gray-500">
                <p>Your voice conversation will appear here...</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              {mode === 'live' ? <LiveTranscriber /> : <FileUploader />}
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-indigo-500" />
                Transcription
              </h2>
              <div className="h-96 bg-gray-950 rounded-lg p-4 overflow-y-auto font-mono text-sm">
                <p className="text-gray-500">
                  {mode === 'live'
                    ? 'Live transcription will appear here...'
                    : 'Upload a file and click transcribe to see results...'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App