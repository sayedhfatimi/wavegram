// Encode mono Float32 PCM to a 16-bit WAV ArrayBuffer. Works in a Worker (no AudioBuffer global)
// by duck-typing the buffer that audiobuffer-to-wav expects.

import audioBufferToWav from 'audiobuffer-to-wav'

/** Encode mono Float32 samples as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  return audioBufferToWav({
    numberOfChannels: 1,
    sampleRate,
    length: samples.length,
    getChannelData: () => samples,
  })
}
