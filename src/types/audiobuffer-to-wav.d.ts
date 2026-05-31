declare module 'audiobuffer-to-wav' {
  interface AudioBufferLike {
    numberOfChannels: number
    sampleRate: number
    length: number
    getChannelData(channel: number): Float32Array
  }
  export default function audioBufferToWav(
    buffer: AudioBufferLike,
    opt?: { float32?: boolean },
  ): ArrayBuffer
}
