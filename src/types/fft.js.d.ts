declare module 'fft.js' {
  /** Minimal typings for fft.js v4 (interleaved [re, im, re, im, ...] complex arrays). */
  export default class FFT {
    constructor(size: number)
    readonly size: number
    createComplexArray(): number[]
    /** Real -> complex. Fills the lower half of `out`; call completeSpectrum after. */
    realTransform(out: number[] | Float64Array, input: ArrayLike<number>): void
    /** Fill the conjugate-symmetric upper half of a spectrum produced by realTransform. */
    completeSpectrum(spectrum: number[] | Float64Array): void
    /** Complex -> complex inverse transform (already scaled by 1/size). */
    inverseTransform(out: number[] | Float64Array, input: ArrayLike<number>): void
    transform(out: number[] | Float64Array, input: ArrayLike<number>): void
    fromComplexArray(complex: ArrayLike<number>, storage?: number[]): number[]
    toComplexArray(input: ArrayLike<number>, storage?: number[]): number[]
  }
}
