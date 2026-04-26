import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'

interface LiveTranscriberProps {
  onTranscriptUpdate?: (text: string) => void
}

const SAMPLE_RATE = 16000

export function LiveTranscriber({ onTranscriptUpdate }: LiveTranscriberProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [transcript, setTranscript] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const wsUrl = `wss://${window.location.host}/ws/`

  const connectWebSocket = useCallback(async () => {
    setIsConnecting(true)
    setStatus('Connecting...')
    
    try {
      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      
      ws.onopen = () => {
        setIsConnecting(false)
        setStatus('Recording...')
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'partial' || data.type === 'final') {
            if (data.text && data.text.trim()) {
              setTranscript(data.text)
              if (onTranscriptUpdate) onTranscriptUpdate(data.text)
            }
          } else if (data.type === 'error') {
            console.error('Transcription error:', data.message)
            setStatus('Error: ' + data.message)
          }
        } catch (e) {
          console.error('Failed to parse message:', e)
        }
      }
      
      ws.onclose = () => {
        setStatus('')
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setStatus('Connection error')
      }
      
      wsRef.current = ws
    } catch (error) {
      console.error('Failed to connect:', error)
      setStatus('Failed to connect')
      setIsConnecting(false)
    }
  }, [onTranscriptUpdate, wsUrl])

  const sendAudioData = useCallback((audioData: Float32Array) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const int16Data = new Int16Array(audioData.length)
      for (let i = 0; i < audioData.length; i++) {
        int16Data[i] = Math.max(-1, Math.min(1, audioData[i])) * 32767
      }
      wsRef.current.send(int16Data.buffer)
    }
  }, [])

  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      source.connect(processor)
      processor.connect(audioContext.destination)

      processor.onaudioprocess = (e) => {
        const inputBuffer = e.inputBuffer
        const channelData = inputBuffer.getChannelData(0)
        
        // Calculate audio level for visualization
        let sum = 0
        for (let i = 0; i < channelData.length; i++) {
          sum += Math.abs(channelData[i])
        }
        setAudioLevel(sum / channelData.length)

        // Send audio to server
        sendAudioData(channelData)
      }

      setStatus('Recording...')
    } catch (error) {
      console.error('Failed to capture audio:', error)
      setStatus('Mic permission denied')
    }
  }, [sendAudioData])

  const stopAudioCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAudioLevel(0)
  }, [])

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      stopAudioCapture()
    }
  }, [stopAudioCapture])

  const startRecording = () => {
    setTranscript('')
    connectWebSocket().then(() => startAudioCapture())
  }

  const stopRecording = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_of_audio' }))
    }
    wsRef.current = null
    stopAudioCapture()
    setIsRecording(false)
    setStatus('')
  }

  const handleButtonClick = () => {
    if (isRecording) {
      stopRecording()
      setIsRecording(false)
    } else {
      setIsRecording(true)
      startRecording()
    }
  }

  const spectrumBars = 20

  return (
    <div className="flex flex-col items-center gap-8 py-12">
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
          onClick={handleButtonClick}
          disabled={isConnecting}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ${
            isRecording 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-indigo-600 hover:bg-indigo-700'
          } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isConnecting ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-10 h-10" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-lg font-medium mb-2">
          {status || (isConnecting 
            ? 'Connecting...' 
            : isRecording 
              ? 'Recording... Click to stop'
              : 'Click to start recording')}
        </p>
        <p className="text-gray-500 text-sm">
          {isRecording 
            ? 'Speak into your microphone' 
            : 'Real-time speech to text transcription'}
        </p>
      </div>

      {transcript && (
        <div className="w-full max-w-md bg-gray-900 rounded-lg p-4">
          <p className="text-white">{transcript}</p>
        </div>
      )}
    </div>
  )
}