import { useState, useCallback } from 'react';
import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } from '@spotify/basic-pitch';
import { Midi } from '@tonejs/midi';
import { decodeAndResample, getSegments } from '@/lib/audioUtils';

const MODEL_URL = 'https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json';

export interface TranscriptionState {
  isProcessing: boolean;
  progress: number;
  status: string;
  error: string | null;
  midiData: Blob | null;
}

export function useTranscription() {
  const [state, setState] = useState<TranscriptionState>({
    isProcessing: false,
    progress: 0,
    status: 'Idle',
    error: null,
    midiData: null,
  });

  const transcribe = useCallback(async (file: File) => {
    setState({ isProcessing: true, progress: 0, status: 'Decoding audio...', error: null, midiData: null });

    try {
      // 1. Decode and Resample
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await decodeAndResample(arrayBuffer);
      
      setState(s => ({ ...s, status: 'Initializing AI model...', progress: 10 }));
      
      // 2. Initialize Basic Pitch
      const basicPitch = new BasicPitch(MODEL_URL);
      
      // 3. Segment and Process
      const segmentDuration = 30;
      const overlapDuration = 0.5;
      const segments = getSegments(audioBuffer, segmentDuration, overlapDuration);
      const totalSegments = segments.length;
      
      const midi = new Midi();
      const track = midi.addTrack();

      for (let i = 0; i < totalSegments; i++) {
        const segmentStartTime = i * (segmentDuration - overlapDuration);
        
        setState(s => ({ 
          ...s, 
          status: `Analyzing segment ${i + 1} of ${totalSegments}...`, 
          progress: 10 + (i / totalSegments) * 80 
        }));

        const frames: number[][] = [];
        const onsets: number[][] = [];
        const contours: number[][] = [];

        await basicPitch.evaluateModel(
          segments[i],
          (f, o, c) => {
            frames.push(...f);
            onsets.push(...o);
            contours.push(...c);
          },
          (p) => {
            const totalProgress = 10 + (i / totalSegments) * 80 + (p / totalSegments) * 80;
            setState(s => ({ ...s, progress: Math.min(95, totalProgress) }));
          }
        );

        const notes = outputToNotesPoly(frames, onsets, 0.25, 0.25, 5);
        const notesWithBends = addPitchBendsToNoteEvents(contours, notes);
        const segmentNotes = noteFramesToTime(notesWithBends);
        
        segmentNotes.forEach(note => {
          track.addNote({
            midi: note.pitchMidi,
            time: note.startTimeSeconds + segmentStartTime,
            duration: note.durationSeconds,
            velocity: note.amplitude,
          });
        });
      }

      setState(s => ({ ...s, status: 'Generating MIDI file...', progress: 95 }));

      const midiBlob = new Blob([midi.toArray() as any], { type: 'audio/midi' });
      
      setState({
        isProcessing: false,
        progress: 100,
        status: 'Conversion complete!',
        error: null,
        midiData: midiBlob,
      });

    } catch (err: any) {
      console.error(err);
      setState({
        isProcessing: false,
        progress: 0,
        status: 'Error',
        error: err.message || 'An unexpected error occurred.',
        midiData: null,
      });
    }
  }, []);

  return { ...state, transcribe };
}
