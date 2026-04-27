import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Loader2, Send, Trash2, MessageSquare } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  audioUrl?: string
  timestamp: number
}

interface VoiceChatProps {
  sessionId?: string
}

const SAMPLE_RATE = 16000

export function VoiceChat({ sessionId: initialSessionId }: VoiceChatProps) {
  const [sessionId, setSessionId] = useState(initialSessionId || '')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [messages, setMessages] = useState<Message[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const wsUrl = `wss://${window.location.host}/ws/voice`

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      const chunks: Blob[] = []
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType })
        chunksRef.current = []
        await processAudio(blob)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000)

      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      source.connect(processor)
      processor.connect(audioContext.destination)

      processor.onaudioprocess = (e) => {
        const inputBuffer = e.inputBuffer
        const channelData = inputBuffer.getChannelData(0)
        let sum = 0
        for (let i = 0; i < channelData.length; i++) {
          sum += Math.abs(channelData[i])
        }
        setAudioLevel(sum / channelData.length)
      }

      setIsRecording(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAudioLevel(0)
    setIsRecording(false)
  }, [])

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true)

    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.webm')
      if (sessionId) {
        formData.append('session_id', sessionId)
      }

      const response = await fetch('/api/voice/chat', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to process audio')
      }

      const data = await response.json()

      if (data.session_id) {
        setSessionId(data.session_id)
      }

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'user',
          text: data.transcribed_text,
          timestamp: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.response_text,
          audioUrl: data.audio_url,
          timestamp: Date.now(),
        },
      ])
    } catch (error) {
      console.error('Failed to process audio:', error)
    } finally {
      setIsProcessing(false)
      setCurrentTranscript('')
    }
  }

  const playAudio = useCallback((audioUrl: string) => {
    if (audioElementRef.current) {
      audioElementRef.current.pause()
    }
    const audio = new Audio(audioUrl)
    audioElementRef.current = audio
    audio.onplay = () => setIsPlaying(true)
    audio.onended = () => setIsPlaying(false)
    audio.play()
  }, [])

  const clearSession = useCallback(async () => {
    if (sessionId) {
      await fetch(`/api/voice/session/${sessionId}`, { method: 'DELETE' })
    }
    setSessionId('')
    setMessages([])
  }, [sessionId])

  useEffect(() => {
    return () => {
      stopRecording()
      if (audioElementRef.current) {
        audioElementRef.current.pause()
      }
    }
  }, [stopRecording])

  const spectrumBars = 20

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-center">
              {isProcessing ? 'Processing your message...' : 'Click the microphone and speak'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-white'
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                {msg.audioUrl && (
                  <button
                    onClick={() => playAudio(msg.audioUrl!)}
                    className="mt-2 flex items-center gap-2 text-xs opacity-75 hover:opacity-100"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Play Voice
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {currentTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-lg p-3 bg-indigo-600/50 text-white">
              <p className="text-sm animate-pulse">{currentTranscript}</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-1">
                {[...Array(spectrumBars)].map((_, i) => {
                  const height = isRecording
                    ? Math.max(4, audioLevel * 200 * Math.sin((i / spectrumBars) * Math.PI))
                    : 4
                  return (
                    <div
                      key={i}
                      className="w-1 bg-indigo-500 rounded-full transition-all duration-75"
                      style={{ height: `${height}px` }}
                    />
                  )
                })}
              </div>
            </div>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </div>

          <p className="text-sm text-gray-400">
            {isProcessing
              ? 'Processing...'
              : isRecording
                ? 'Recording... Click to stop'
                : 'Click to speak'}
          </p>

          {messages.length > 0 && (
            <button
              onClick={clearSession}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300"
            >
              <Trash2 className="w-4 h-4" />
              Clear Conversation
            </button>
          )}
        </div>
      </div>
    </div>
  )
}