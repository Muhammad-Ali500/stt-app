import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranscriptStore } from '../../store/transcript'
import { Mic, Square, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import WaveSurfer from 'wavesurfer.js'

interface UseWhisperSocketProps {
  onTranscript?: (text: string, isFinal: boolean) => void
}

export function useWhisperSocket({ onTranscript }: UseWhisperSocketProps = {}) {
  const ws = useRef<WebSocket | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const source = useRef<MediaStreamAudioSourceNode | null>(null)
  const worklet = useRef<AudioWorkletNode | null>(null)
  const { addInterim, commitFinal, setRecording, setProcessing, setError } = useTranscriptStore()
  
  const connect = useCallback(async () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/live`
    
    ws.current = new WebSocket(wsUrl)
    ws.current.binaryType = 'arraybuffer'

    ws.current.onopen = () => {
      console.log('WebSocket connected')
      setProcessing(true)
    }

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        
        if (msg.type === 'partial') {
          addInterim(msg.text)
          onTranscript?.(msg.text, false)
        } else if (msg.type === 'final') {
          commitFinal(msg.text)
          onTranscript?.(msg.text, true)
        } else if (msg.type === 'error') {
          setError(msg.message)
        }
      } catch (e) {
        console.error('Failed to parse message:', e)
      }
    }

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error)
      setError('Connection error')
    }

    ws.current.onclose = () => {
      console.log('WebSocket closed')
      setProcessing(false)
    }
  }, [addInterim, commitFinal, setProcessing, setError, onTranscript])

  const startRecording = useCallback(async () => {
    try {
      await connect()
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      })

      audioContext.current = new AudioContext({ sampleRate: 16000 })
      source.current = audioContext.current.createMediaStreamSource(stream)

      try {
        await audioContext.current.audioWorklet.addModule('/worklets/pcm-processor.js')
        worklet.current = new AudioWorkletNode(audioContext.current, 'pcm-processor')
        
        worklet.current.port.onmessage = (event) => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(event.data)
          }
        }
        
        source.current.connect(worklet.current)
      } catch (e) {
        console.error('AudioWorklet not supported, using fallback')
        const processor = audioContext.current.createScriptProcessor(4096, 1, 1)
        source.current.connect(processor)
        processor.connect(audioContext.current.destination)
        
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0)
          const int16Data = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
          }
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(int16Data.buffer)
          }
        }
      }

      setRecording(true)
    } catch (e) {
      console.error('Failed to start recording:', e)
      setError('Failed to access microphone')
    }
  }, [connect, setRecording, setError])

  const stopRecording = useCallback(() => {
    if (ws.current) {
      ws.current.send(JSON.stringify({ type: 'end_of_audio' }))
      ws.current.close()
      ws.current = null
    }

    if (source.current) {
      source.current.disconnect()
      source.current = null
    }

    if (audioContext.current) {
      audioContext.current.close()
      audioContext.current = null
    }

    setRecording(false)
    setProcessing(false)
  }, [setRecording, setProcessing])

  return { startRecording, stopRecording }
}

export function LiveTranscriber() {
  const { segments, interimText, isRecording, isProcessing, error, clearTranscript } = useTranscriptStore()
  const { startRecording, stopRecording } = useWhisperSocket()
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  useEffect(() => {
    if (!waveformRef.current || wavesurferRef.current) return

    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#6366f1',
      progressColor: '#4f46e5',
      cursorColor: '#4f46e5',
      barWidth: 2,
      barRadius: 2,
      height: 80,
      normalize: true,
      interact: false,
    })

    return () => {
      wavesurferRef.current?.destroy()
      wavesurferRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isRecording) return

    let animationFrame: number
    let stream: MediaStream

    const updateLevel = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const check = () => {
          analyser.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setAudioLevel(avg / 255)
          if (isRecording) {
            animationFrame = requestAnimationFrame(check)
          }
        }
        check()
      } catch (e) {
        console.error('Error getting audio level:', e)
      }
    }

    updateLevel()

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [isRecording])

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div className="flex flex-col items-center gap-4">
        <div 
          ref={waveformRef} 
          className={cn(
            "w-full rounded-lg bg-gray-900 transition-opacity",
            isRecording ? "opacity-100" : "opacity-50"
          )}
        />
        
        <div 
          className={cn(
            "w-full h-20 rounded-lg bg-gray-900 flex items-center justify-center",
            isRecording && "animate-pulse"
          )}
          style={{
            background: isRecording 
              ? `linear-gradient(90deg, #6366f1 ${audioLevel * 100}%, #374151 ${audioLevel * 100}%)`
              : undefined
          }}
        >
          {!isRecording && <span className="text-gray-500">Waveform visualization</span>}
        </div>

        <button
          onClick={toggleRecording}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all",
            isRecording 
              ? "bg-red-600 hover:bg-red-700 text-white" 
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          )}
        >
          {isRecording ? (
            <>
              <Square className="w-5 h-5" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Start Recording
            </>
          )}
        </button>

        {isProcessing && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Processing audio...</span>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
      </div>

      <div className="bg-gray-900 rounded-lg p-4 min-h-[200px]">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium">Transcript</h3>
          <button
            onClick={clearTranscript}
            className="text-sm text-gray-400 hover:text-white"
          >
            Clear
          </button>
        </div>

        <div className="space-y-2">
          {segments.map((seg, i) => (
            <p key={i} className="text-white">{seg.text}</p>
          ))}
          {interimText && (
            <p className="text-gray-400 italic">{interimText}</p>
          )}
          {!segments.length && !interimText && (
            <p className="text-gray-500">Your transcript will appear here...</p>
          )}
        </div>
      </div>
    </div>
  )
}