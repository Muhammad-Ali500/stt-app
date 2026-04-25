const API_BASE = '/api'

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface TranscriptionJobStatus {
  job_id: string
  status: 'queued' | 'processing' | 'complete' | 'error'
  progress: number
  segments: TranscriptionSegment[]
  error?: string
  full_text?: string
}

export async function uploadAudioFile(file: File): Promise<{ job_id: string; filename: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/transcribe/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(error.detail || 'Upload failed')
  }

  return response.json()
}

export async function getJobStatus(jobId: string): Promise<TranscriptionJobStatus> {
  const response = await fetch(`${API_BASE}/transcribe/${jobId}/status`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch job status')
  }
  
  return response.json()
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/transcribe/${jobId}`, {
    method: 'DELETE',
  })
}

export async function checkHealth(): Promise<{ status: string; model: string; device: string }> {
  const response = await fetch(`${API_BASE}/health`)
  return response.json()
}