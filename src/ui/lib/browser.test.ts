import { describe, expect, it } from 'vitest'
import { fileFromDropEvent, fileFromPasteEvent } from './browser'

const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'wavegram.png', {
  type: 'image/png',
})

describe('fileFromDropEvent', () => {
  it('returns the first dropped file', () => {
    expect(fileFromDropEvent({ dataTransfer: { files: [png] } })).toBe(png)
  })

  it('returns undefined when there is no file', () => {
    expect(fileFromDropEvent({ dataTransfer: { files: [] } })).toBeUndefined()
    expect(fileFromDropEvent({ dataTransfer: null })).toBeUndefined()
    expect(fileFromDropEvent({})).toBeUndefined()
  })
})

describe('fileFromPasteEvent', () => {
  it('returns the first pasted file', () => {
    expect(fileFromPasteEvent({ clipboardData: { files: [png] } })).toBe(png)
  })

  it('returns undefined when the clipboard carries no file', () => {
    expect(fileFromPasteEvent({ clipboardData: { files: [] } })).toBeUndefined()
    expect(fileFromPasteEvent({ clipboardData: null })).toBeUndefined()
    expect(fileFromPasteEvent({})).toBeUndefined()
  })
})
