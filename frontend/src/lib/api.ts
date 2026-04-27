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

export interface VoiceChatResponse {
  session_id: string
  transcribed_text: string
  response_text: string
  audio_url: string
}

export interface ModelInfo {
  stt: { model: string; device: string }
  llm: { model: string; available: boolean; url: string }
  tts: { model: string; sample_rate: number; languages: string[] }
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

export async function voiceChat(
  audioBlob: Blob,
  sessionId?: string
): Promise<VoiceChatResponse> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.webm')
  if (sessionId) {
    formData.append('session_id', sessionId)
  }

  const response = await fetch(`${API_BASE}/voice/chat`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Voice chat failed' }))
    throw new Error(error.detail || 'Voice chat failed')
  }

  return response.json()
}

export async function synthesizeSpeech(
  text: string,
  language: string = 'en'
): Promise<Blob> {
  const response = await fetch(`${API_BASE}/voice/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  })

  if (!response.ok) {
    throw new Error('Speech synthesis failed')
  }

  return response.blob()
}

export async function clearVoiceSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/voice/session/${sessionId}`, {
    method: 'DELETE',
  })
}

export async function getModelInfo(): Promise<ModelInfo> {
  const response = await fetch(`${API_BASE}/voice/models`)
  return response.json()
}