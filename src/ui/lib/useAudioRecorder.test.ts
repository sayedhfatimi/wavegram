import { describe, expect, it } from 'vitest'
import { pickRecorderMimeType, recorderFileExtension } from './useAudioRecorder'

describe('pickRecorderMimeType', () => {
  it('prefers audio/mp4 when supported (Safari/iOS)', () => {
    expect(pickRecorderMimeType(() => true)).toBe('audio/mp4')
  })

  it('falls back to webm/opus when mp4 is unsupported (Chrome)', () => {
    const isSupported = (t: string) => t !== 'audio/mp4'
    expect(pickRecorderMimeType(isSupported)).toBe('audio/webm;codecs=opus')
  })

  it('falls back to plain webm when only that is supported', () => {
    const isSupported = (t: string) => t === 'audio/webm'
    expect(pickRecorderMimeType(isSupported)).toBe('audio/webm')
  })

  it('returns empty string when nothing is supported (let the browser default)', () => {
    expect(pickRecorderMimeType(() => false)).toBe('')
  })

  it('honors the mp4 > webm;opus > webm preference order', () => {
    // everything supported -> first wins
    expect(pickRecorderMimeType(() => true)).toBe('audio/mp4')
  })
})

describe('recorderFileExtension', () => {
  it('maps mp4 to .m4a', () => {
    expect(recorderFileExtension('audio/mp4')).toBe('.m4a')
  })

  it('maps any webm variant to .webm', () => {
    expect(recorderFileExtension('audio/webm')).toBe('.webm')
    expect(recorderFileExtension('audio/webm;codecs=opus')).toBe('.webm')
  })

  it('defaults to .webm for unknown/empty mime', () => {
    expect(recorderFileExtension('')).toBe('.webm')
    expect(recorderFileExtension('audio/ogg')).toBe('.webm')
  })
})
