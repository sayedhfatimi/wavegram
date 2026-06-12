// 140-bit self-describing metadata header. Field layout (read MSB-first, in order):
//
//   magic        32 bits  0x41554456 ("AUDV")
//   version       4 bits
//   reserved      2 bits  bit 0 = precision flag, bit 1 spare (zero)
//   sampleRate   24 bits
//   fftSize      11 bits  (widened from the spec's 10 bits: 1024 needs 11 bits; max 2047)
//   hopSize      11 bits  (widened to match; max 2047)
//   sampleCount  32 bits
//   channels      8 bits
//   crc16        16 bits  CRC-16/CCITT-FALSE over the preceding 124 bits
//
// Total: 140 bits. The 2 extra bits for fft/hop are borrowed from the spec's 4 reserved bits,
// keeping the structure at exactly 140 bits (70 squares x 2 rows). The CRC covers everything
// before it. FFT sizes are powers of two; 256/512/1024 all fit.

import { MAGIC, type Precision, type WavegramHeader } from '../params'
import { crc16 } from './crc16'

export const HEADER_BITS = 140
const PAYLOAD_BITS = 124 // everything before the 16-bit CRC

// Field bit offsets (start positions), in order.
const OFF = {
  magic: 0, // 32
  version: 32, // 4
  precision: 36, // 1
  hasPhase: 37, // 1 (was reserved spare)
  sampleRate: 38, // 24
  fftSize: 62, // 11
  hopSize: 73, // 11
  sampleCount: 84, // 32
  channels: 116, // 8
  crc: PAYLOAD_BITS, // 16
} as const

export interface DecodedHeader {
  magicValid: boolean
  crcValid: boolean
  /** Parsed fields. Present whenever magic is valid (even if CRC fails). */
  header: WavegramHeader | null
}

/** Append `width` bits of `value` (MSB-first) to `bits`. */
function pushBits(bits: number[], value: number, width: number): void {
  // Guard against silent truncation: a value that doesn't fit the field is a bug (it would
  // otherwise drop high bits and still pass CRC, as fftSize 2048 did). Use 2 ** width rather
  // than 1 << width, which overflows for the 32-bit magic / sampleCount fields.
  if (value < 0 || value >= 2 ** width) {
    throw new Error(`header value ${value} does not fit in ${width} bits`)
  }
  for (let i = width - 1; i >= 0; i--) {
    bits.push((value >>> i) & 1)
  }
}

/** Read `width` bits (MSB-first) starting at `offset`. Returns an unsigned int. */
function readBits(bits: Uint8Array, offset: number, width: number): number {
  let value = 0
  for (let i = 0; i < width; i++) {
    value = value * 2 + (bits[offset + i] & 1)
  }
  return value >>> 0
}

/** Encode a header into a 140-element bit array (each element 0 or 1). */
export function packHeader(h: WavegramHeader): Uint8Array {
  const bits: number[] = []
  pushBits(bits, MAGIC >>> 0, 32)
  pushBits(bits, h.version, 4)
  pushBits(bits, h.precision, 1) // reserved bit 0
  pushBits(bits, h.hasPhase ? 1 : 0, 1) // reserved bit 1: phase-seed flag
  pushBits(bits, h.sampleRate, 24)
  // v3+ stores fftSize as a base-2 exponent (1024 -> 10) so 2048+ fit the 11-bit field;
  // v1/v2 stored the raw value. hopSize is always raw (<= 1024 for every supported size).
  pushBits(bits, h.version >= 3 ? Math.round(Math.log2(h.fftSize)) : h.fftSize, 11)
  pushBits(bits, h.hopSize, 11)
  pushBits(bits, h.sampleCount >>> 0, 32)
  pushBits(bits, h.channels, 8)

  const crc = crc16(Uint8Array.from(bits))
  pushBits(bits, crc, 16)

  return Uint8Array.from(bits)
}

/** Decode and validate a 140-bit header. */
export function unpackHeader(bits: Uint8Array): DecodedHeader {
  const magic = readBits(bits, OFF.magic, 32)
  const magicValid = magic === MAGIC >>> 0

  const storedCrc = readBits(bits, OFF.crc, 16)
  const computedCrc = crc16(bits.subarray(0, PAYLOAD_BITS))
  const crcValid = storedCrc === computedCrc

  if (!magicValid) {
    return { magicValid, crcValid, header: null }
  }

  const version = readBits(bits, OFF.version, 4)
  const fftField = readBits(bits, OFF.fftSize, 11)
  return {
    magicValid,
    crcValid,
    header: {
      version,
      precision: readBits(bits, OFF.precision, 1) as Precision,
      hasPhase: readBits(bits, OFF.hasPhase, 1) === 1,
      sampleRate: readBits(bits, OFF.sampleRate, 24),
      // v3+ stores fftSize as a base-2 exponent; v1/v2 stored the raw value.
      fftSize: version >= 3 ? 1 << fftField : fftField,
      hopSize: readBits(bits, OFF.hopSize, 11),
      sampleCount: readBits(bits, OFF.sampleCount, 32),
      channels: readBits(bits, OFF.channels, 8),
    },
  }
}
