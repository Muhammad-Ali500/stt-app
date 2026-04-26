import { useState, useCallback } from 'react'
import { Upload, FileAudio, X, Loader2, Play, Check, AlertCircle } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { uploadAudioFile, getJobStatus, TranscriptionJobStatus } from '../../lib/api'

export function FileUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [jobStatus, setJobStatus] = useState<TranscriptionJobStatus | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setJobStatus(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac', '.mp4']
    },
    maxFiles: 1,
    disabled: isUploading
  })

  const handleUpload = async () => {
    if (!file) return
    
    setIsUploading(true)
    try {
      const result = await uploadAudioFile(file)
      startPolling(result.job_id)
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const startPolling = async (id: string) => {
    setIsTranscribing(true)
    const poll = async () => {
      try {
        const status = await getJobStatus(id)
        setJobStatus(status)
        
        if (status.status === 'complete' || status.status === 'error') {
          setIsTranscribing(false)
          return
        }
        
        setTimeout(poll, 2000)
      } catch (error) {
        console.error('Polling error:', error)
        setIsTranscribing(false)
      }
    }
    poll()
  }

  const reset = () => {
    setFile(null)
    setJobStatus(null)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {!file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-indigo-500 bg-indigo-900/20' 
              : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">
            {isDragActive ? 'Drop your audio file here' : 'Drag & drop audio file'}
          </p>
          <p className="text-gray-500 text-sm">
            MP3, WAV, M4A, OGG, WEBM, FLAC supported
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileAudio className="w-8 h-8 text-indigo-500" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={reset}
              className="p-2 hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {jobStatus?.status === 'complete' ? (
            <div className="bg-green-900/30 border border-green-600 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-5 h-5 text-green-500" />
                <span className="text-green-400 font-medium">Transcription Complete</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {jobStatus.segments.map((seg, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-gray-500 shrink-0">
                      {formatTime(seg.start)}
                    </span>
                    <p className="text-white">{seg.text}</p>
                  </div>
                ))}
              </div>
              {jobStatus.full_text && (
                <div className="mt-4 pt-4 border-t border-green-700">
                  <p className="text-gray-300 whitespace-pre-wrap">
                    {jobStatus.full_text}
                  </p>
                </div>
              )}
            </div>
          ) : jobStatus?.status === 'error' ? (
            <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-400">Error: {jobStatus.error || 'Transcription failed'}</span>
              </div>
            </div>
          ) : isTranscribing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Transcribing...</span>
                <span className="text-gray-400">
                  {Math.round((jobStatus?.progress || 0) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${(jobStatus?.progress || 0) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing audio...
              </div>
            </div>
          ) : (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Transcribe
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}