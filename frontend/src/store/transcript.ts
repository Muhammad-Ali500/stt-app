import { create } from 'zustand'

export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

interface TranscriptState {
  segments: TranscriptSegment[]
  interimText: string
  isRecording: boolean
  isProcessing: boolean
  error: string | null
  
  addInterim: (text: string) => void
  commitFinal: (text: string) => void
  clearTranscript: () => void
  setRecording: (recording: boolean) => void
  setProcessing: (processing: boolean) => void
  setError: (error: string | null) => void
  setSegments: (segments: TranscriptSegment[]) => void
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  segments: [],
  interimText: '',
  isRecording: false,
  isProcessing: false,
  error: null,

  addInterim: (text) => set({ interimText: text }),
  
  commitFinal: (text) => set((state) => ({
    segments: [...state.segments, { start: 0, end: 0, text }],
    interimText: '',
  })),
  
  clearTranscript: () => set({ segments: [], interimText: '', error: null }),
  
  setRecording: (isRecording) => set({ isRecording }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setError: (error) => set({ error }),
  setSegments: (segments) => set({ segments }),
}))