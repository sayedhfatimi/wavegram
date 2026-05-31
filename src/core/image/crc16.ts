// CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no input/output reflection, no final XOR.
// Operates bit-by-bit (MSB-first) so it works on non-byte-aligned bit arrays such as the
// 124-bit header payload. For byte-aligned input this matches the canonical byte-oriented CRC.

const POLY = 0x1021

/** Expand bytes to a bit array, most-significant bit first. */
export function bytesToBits(bytes: Uint8Array): Uint8Array {
  const bits = new Uint8Array(bytes.length * 8)
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]
    for (let b = 0; b < 8; b++) {
      bits[i * 8 + b] = (byte >> (7 - b)) & 1
    }
  }
  return bits
}

/** Compute CRC-16/CCITT-FALSE over a bit array (each element 0 or 1). */
export function crc16(bits: Uint8Array | number[]): number {
  let crc = 0xffff
  for (let i = 0; i < bits.length; i++) {
    const bit = bits[i] & 1
    const top = (crc >> 15) & 1
    crc = (crc << 1) & 0xffff
    if (top ^ bit) crc ^= POLY
  }
  return crc & 0xffff
}
