import { useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

interface AudioPlayerProps {
  src: string
  autoPlay?: boolean
  onEnded?: () => void
}

export function AudioPlayer({ src, autoPlay = false, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)

  const [isPlaying, setIsPlaying] = (0, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const setupAudioContext = async () => {
      try {
        audioContextRef.current = new AudioContext()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256

        const source = audioContextRef.current.createMediaElementSource(audio)
        source.connect(analyserRef.current)
        analyserRef.current.connect(audioContextRef.current.destination)
      } catch (e) {
        console.error('Failed to setup audio context:', e)
      }
    }

    audio.onplay = () => setIsPlaying(true)
    audio.onpause = () => setIsPlaying(false)
    audio.onended = () => {
      setIsPlaying(false)
      onEnded?.()
    }

    if (autoPlay) {
      audio.play()
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [src, autoPlay, onEnded])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      audio.play()
    } else {
      audio.pause()
    }
  }, [])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = parseFloat(e.target.value)
    }
  }, [])

  return (
    <div className="flex items-center gap-3 bg-gray-900 rounded-lg p-3">
      <audio ref={audioRef} src={src} preload="auto" />

      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </button>

      <canvas
        ref={canvasRef}
        className="flex-1 h-8 bg-gray-800 rounded"
        width={200}
        height={32}
      />

      <div className="flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-gray-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          defaultValue="1"
          onChange={handleVolumeChange}
          className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  )
}

export function WaveformVisualizer({ audioUrl }: { audioUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      if (!analyserRef.current || !ctx) return

      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyserRef.current.getByteTimeDomainData(dataArray)

      ctx.fillStyle = 'rgb(31, 41, 55)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgb(99, 102, 241)'
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()

      animationRef.current = requestAnimationFrame(draw)
    }

    const initAudio = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext()
        }

        if (!sourceRef.current) {
          const audio = new Audio(audioUrl)
          sourceRef.current = audioContextRef.current.createMediaElementSource(audio)
          analyserRef.current = audioContextRef.current.createAnalyser()
          analyserRef.current.fftSize = 256
          sourceRef.current.connect(analyserRef.current)
          analyserRef.current.connect(audioContextRef.current.destination)

          audio.addEventListener('ended', () => {
            if (animationRef.current) {
              cancelAnimationFrame(animationRef.current)
            }
            drawStaticWaveform()
          })
        }

        draw()
      } catch (e) {
        console.error('Failed to initialize audio:', e)
        drawStaticWaveform()
      }
    }

    const drawStaticWaveform = () => {
      if (!ctx) return
      ctx.fillStyle = 'rgb(31, 41, 55)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = 'rgb(99, 102, 241)'
      ctx.beginPath()
      ctx.moveTo(0, canvas.height / 2)
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }

    initAudio()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [audioUrl])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16 bg-gray-800 rounded-lg"
      width={400}
      height={64}
    />
  )
}