import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Upload, FileAudio, X, Copy, Download, Loader2, Check } from 'lucide-react'
import { cn, formatFileSize, downloadFile, segmentsToText, segmentsToSRT, segmentsToVTT } from '../../lib/utils'
import { uploadAudioFile, getJobStatus } from '../../lib/api'

interface FileUploaderProps {
  onUploadComplete?: (segments: { start: number; end: number; text: string }[]) => void
}

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const { mutate: uploadFile, isPending: isUploading } = useMutation({
    mutationFn: uploadAudioFile,
    onSuccess: (data) => {
      setJobId(data.job_id)
      startPolling(data.job_id)
    },
    onError: (error) => {
      alert(error.message)
    }
  })

  const { data: jobStatus, isLoading: isPolling } = useQuery({
    queryKey: ['transcription', jobId],
    queryFn: () => jobId ? getJobStatus(jobId) : null,
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'complete' || status === 'error') return false
      return 2000
    }
  })

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    
    pollRef.current = setInterval(async () => {
      try {
        const status = await getJobStatus(id)
        if (status.status === 'complete' || status.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
          if (status.status === 'complete' && onUploadComplete) {
            onUploadComplete(status.segments)
          }
        }
      } catch (e) {
        console.error('Polling error:', e)
      }
    }, 2000)
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      uploadFile(acceptedFiles[0])
    }
  }, [uploadFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac', '.mp4']
    },
    maxFiles: 1,
    disabled: isUploading
  })

  const reset = () => {
    setFile(null)
    setJobId(null)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const copyToClipboard = () => {
    if (jobStatus?.full_text) {
      navigator.clipboard.writeText(jobStatus.full_text)
    }
  }

  const isComplete = jobStatus?.status === 'complete'
  const isError = jobStatus?.status === 'error'

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {!jobId ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
            isDragActive 
              ? "border-indigo-500 bg-indigo-900/20" 
              : "border-gray-600 hover:border-gray-500",
            isUploading && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-gray-300">Uploading...</p>
            </div>
          ) : (
            <>
              <p className="text-lg font-medium mb-2">
                {isDragActive ? 'Drop your audio file here' : 'Drag & drop audio file'}
              </p>
              <p className="text-gray-500 text-sm">
                MP3, WAV, M4A, OGG, WEBM, FLAC supported
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileAudio className="w-8 h-8 text-indigo-500" />
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-gray-500">
                  {file && formatFileSize(file.size)}
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

          {isComplete ? (
            <div className="space-y-4">
              <div className="bg-green-900/30 border border-green-600 rounded-lg p-3 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                <span className="text-green-400">Transcription complete!</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={() => jobStatus?.full_text && downloadFile(jobStatus.full_text, 'transcript.txt', 'text/plain')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  <Download className="w-4 h-4" />
                  TXT
                </button>
                <button
                  onClick={() => downloadFile(segmentsToSRT(jobStatus.segments), 'transcript.srt', 'text/srt')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  SRT
                </button>
                <button
                  onClick={() => downloadFile(segmentsToVTT(jobStatus.segments), 'transcript.vtt', 'text/vtt')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  VTT
                </button>
              </div>
            </div>
          ) : isError ? (
            <div className="bg-red-900/30 border border-red-600 rounded-lg p-3">
              <p className="text-red-400">Error: {jobStatus?.error || 'Transcription failed'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Processing...</span>
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
            </div>
          )}

          {jobStatus?.segments && jobStatus.segments.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
              <h3 className="text-lg font-medium mb-3">Transcript</h3>
              <div className="space-y-3">
                {jobStatus.segments.map((seg, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-gray-500 text-sm shrink-0">
                      {Math.floor(seg.start / 60)}:{Math.floor(seg.start % 60).toString().padStart(2, '0')}
                    </span>
                    <p className="text-white">{seg.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}