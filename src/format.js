/**
 * How annotations are described in words, for the tooltips of their boxes and
 * regions. Pure functions, so that they can be tested without a browser.
 */

// "2.50" → "2.5", "96.0" → "96", but "100" stays "100"
function trimZeros(number) {
  return number.indexOf('.') === -1 ? number : number.replace(/0+$/, '').replace(/\.$/, '')
}

/** Seconds, to the hundredth under a minute and to the tenth after */
export function formatSeconds(seconds) {
  return trimZeros(seconds.toFixed(seconds < 60 ? 2 : 1))
}

/** A frequency in Hz below 1 kHz, otherwise in kHz to three figures */
export function formatHz(hz) {
  if (Math.abs(hz) < 1000) return Math.round(hz) + ' Hz'
  const khz = hz / 1000
  const places = Math.abs(khz) < 10 ? 2 : Math.abs(khz) < 100 ? 1 : 0
  return trimZeros(khz.toFixed(places)) + ' kHz'
}

/**
 * An annotation in words: its label, its span of time and, where it has
 * them, its frequency bounds, with "…" for one that is missing.
 */
export function describe(annotation) {
  const parts = []
  if (annotation.label) parts.push(annotation.label)
  parts.push(annotation.end > annotation.start
    ? formatSeconds(annotation.start) + '–' + formatSeconds(annotation.end) + ' s'
    : formatSeconds(annotation.start) + ' s')
  if (annotation.low !== null || annotation.high !== null) {
    parts.push((annotation.low !== null ? formatHz(annotation.low) : '…') + ' to '
      + (annotation.high !== null ? formatHz(annotation.high) : '…'))
  }
  return parts.join(', ')
}
