/**
 * Audio Utilities for AuraMIDI
 * Handles decoding, resampling, and segmenting audio for Basic Pitch.
 */

export const SAMPLE_RATE = 22050;

/**
 * Decodes an ArrayBuffer into an AudioBuffer and resamples it to 22,050 Hz.
 */
export async function decodeAndResample(
  arrayBuffer: ArrayBuffer
): Promise<AudioBuffer> {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: SAMPLE_RATE,
  });

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } catch (error) {
    console.error("Error decoding audio data:", error);
    throw new Error("Failed to decode audio. Please ensure it is a valid MP3 or WAV file.");
  } finally {
  }
}

/**
 * Slices an AudioBuffer into smaller segments (chunks) with optional overlap.
 */
export function getSegments(
  audioBuffer: AudioBuffer, 
  segmentDurationSeconds: number = 30,
  overlapSeconds: number = 0
): AudioBuffer[] {
  const segments: AudioBuffer[] = [];
  const samplesPerSegment = Math.floor(segmentDurationSeconds * SAMPLE_RATE);
  const samplesOverlap = Math.floor(overlapSeconds * SAMPLE_RATE);
  const totalSamples = audioBuffer.length;
  
  const stride = samplesPerSegment - samplesOverlap;

  for (let i = 0; i < totalSamples; i += stride) {
    if (i + samplesOverlap >= totalSamples && segments.length > 0) break;

    const length = Math.min(samplesPerSegment, totalSamples - i);
    const segment = new AudioBuffer({
      length,
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate: SAMPLE_RATE,
    });

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel).subarray(i, i + length);
      segment.copyToChannel(channelData, channel);
    }
    segments.push(segment);

    if (i + length >= totalSamples) break;
  }

  return segments;
}
