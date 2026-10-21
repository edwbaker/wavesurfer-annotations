/**
 * Geometry for showing annotations over a wavesurfer.js waveform and
 * spectrogram. Pure functions, so that they can be tested without a browser.
 *
 * Written for the browsers wavesurfer.js 7 supports without a transpiler:
 * no class fields, no `??=`, no `.at()`.
 */

/**
 * A number from a number or numeric text; null for anything else, including
 * nothing at all, so that a bound that is missing stays missing rather than
 * becoming 0.
 *
 * @param {*} value
 * @returns {number|null}
 */
export function toNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return isFinite(value) ? value : null
  const text = String(value).trim()
  if (text === '') return null
  const number = Number(text)
  return isFinite(number) ? number : null
}

// The names each bound may be given under: this plugin's own, then the
// Audiovisual Core terms (http://rs.tdwg.org/ac/terms/), prefixed or not
const NAMES = {
  start: ['start', 'ac:startTime', 'startTime'],
  end: ['end', 'ac:endTime', 'endTime'],
  low: ['low', 'ac:freqLow', 'freqLow'],
  high: ['high', 'ac:freqHigh', 'freqHigh'],
}

function pick(input, names) {
  for (let i = 0; i < names.length; i++) {
    if (input[names[i]] !== undefined) return toNumber(input[names[i]])
  }
  return null
}

function text(value) {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * An annotation as the plugin keeps it, from one given as an object with its
 * bounds as `start` and `end` (seconds from the start of the recording) and
 * `low` and `high` (Hz), or under their Audiovisual Core names
 * (`ac:startTime`, `ac:endTime`, `ac:freqLow`, `ac:freqHigh`). Either
 * frequency bound may be missing, as Audiovisual Core allows; both missing
 * means the annotation is bounded in time alone. Bounds given the wrong way
 * round are swapped, and one without an end is a moment. A `channel`, counted
 * from 0 as the tiles count them, puts it on that channel alone; without one, it
 * is on every channel.
 *
 * @param {object} input
 * @param {string} fallbackId the id to give it if it has none of its own
 * @returns {{id: string, start: number, end: number, low: number|null,
 *   high: number|null, channel: number|null, label: string, color: string|null,
 *   data: object}|null}
 *   null where it has no start
 */
export function normaliseAnnotation(input, fallbackId) {
  if (!input || typeof input !== 'object') throw new TypeError('An annotation must be an object')
  let start = pick(input, NAMES.start)
  let end = pick(input, NAMES.end)
  if (start === null) return null
  if (end === null) end = start
  if (end < start) {
    const swap = start
    start = end
    end = swap
  }
  let low = pick(input, NAMES.low)
  let high = pick(input, NAMES.high)
  if (low !== null && high !== null && high < low) {
    const swap = low
    low = high
    high = swap
  }
  const ownId = text(input.id !== undefined ? input.id : input['dcterms:identifier'])
  return {
    id: ownId !== '' ? ownId : String(fallbackId),
    start: start,
    end: end,
    low: low,
    high: high,
    channel: toNumber(input.channel),
    label: text(input.label !== undefined ? input.label : input['dwc:scientificName']),
    color: input.color ? String(input.color) : null,
    data: input,
  }
}

/** Whether an annotation is bounded in frequency, by either bound */
export function isBoxed(annotation) {
  return annotation.low !== null || annotation.high !== null
}

/**
 * Where a frequency is, in pixels down from the top of a spectrogram `height`
 * pixels high that shows `min` to `max` Hz on a linear scale.
 */
export function frequencyToY(frequency, min, max, height) {
  return ((max - frequency) / (max - min)) * height
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value))
}

/**
 * Where a span of time is along the recording, as percentages of its
 * duration, which is how wavesurfer.js places regions: they then follow zoom
 * without being moved.
 *
 * @returns {{left: number, width: number}|null}
 */
export function timeLayout(start, end, duration) {
  if (!(duration > 0)) return null
  const left = clamp(start / duration, 0, 1) * 100
  const right = clamp(end / duration, 0, 1) * 100
  return { left: left, width: Math.max(0, right - left) }
}

/**
 * How much room each label has, in pixels: from its box's left edge to the
 * next box's left edge along the timeline, or to the end of the timeline for
 * the last. A label may run on past a narrow box into that room, but never
 * into the next box, so labels never cover one another.
 *
 * @param {number[]} lefts the left edges of the boxes with labels, in pixels,
 *   in any order
 * @param {number} end the right edge of the timeline, in pixels
 * @returns {number[]} the room for each, in the order given
 */
export function labelRooms(lefts, end) {
  const order = lefts.map((left, i) => i).sort((a, b) => lefts[a] - lefts[b] || a - b)
  const rooms = new Array(lefts.length)
  order.forEach((index, k) => {
    const next = k + 1 < order.length ? lefts[order[k + 1]] : end
    rooms[index] = Math.max(0, next - lefts[index])
  })
  return rooms
}

/**
 * Where an annotation's box goes on a spectrogram.
 *
 * Its edges are each `bound` (the annotation's own bound, in view), `open`
 * (the annotation has no bound there, so the box runs to the edge of the
 * spectrogram), or `clipped` (the bound is beyond what the spectrogram shows).
 * A box wholly above or below what is shown is not lost: it becomes a strip
 * `minSize` pixels high along that edge, its `position` saying which. A box
 * smaller than `minSize` either way is drawn that size (across time, by the
 * caller, as its width is a percentage).
 *
 * @param {{start: number, end: number, low: number|null, high: number|null}} annotation
 * @param {{min: number, max: number, height: number}} view Hz shown, and the
 *   spectrogram's height in pixels
 * @param {number} duration of the recording, in seconds
 * @param {number} [minSize] pixels (3)
 * @returns {{left: number, width: number, top: number, height: number,
 *   position: string, edges: {top: string, bottom: string}}|null} null for an
 *   annotation bounded in time alone, or where nothing can be placed yet
 */
export function boxLayout(annotation, view, duration, minSize) {
  if (!isBoxed(annotation)) return null
  const time = timeLayout(annotation.start, annotation.end, duration)
  if (!time || !view || !(view.max > view.min) || !(view.height > 0)) return null
  const size = minSize > 0 ? minSize : 3
  const height = view.height
  const low = annotation.low !== null ? annotation.low : view.min
  const high = annotation.high !== null ? annotation.high : view.max
  const edges = {
    top: annotation.high === null ? 'open' : annotation.high > view.max ? 'clipped' : 'bound',
    bottom: annotation.low === null ? 'open' : annotation.low < view.min ? 'clipped' : 'bound',
  }
  const box = { left: time.left, width: time.width, top: 0, height: size, position: 'inside', edges: edges }
  if (low > view.max) {
    box.position = 'above'
    box.top = 0
    return box
  }
  if (high < view.min) {
    box.position = 'below'
    box.top = Math.max(0, height - size)
    return box
  }
  const top = frequencyToY(Math.min(high, view.max), view.min, view.max, height)
  const bottom = frequencyToY(Math.max(low, view.min), view.min, view.max, height)
  if (bottom - top >= size) {
    box.top = top
    box.height = bottom - top
  } else {
    // Too thin to see, a point in frequency at most: drawn minSize high,
    // centred on it, and kept on the spectrogram
    box.height = Math.min(size, height)
    box.top = clamp((top + bottom) / 2 - box.height / 2, 0, height - box.height)
  }
  return box
}

/**
 * Whether two placements from boxLayout() put a box in the same place, in the
 * same look, so that a box already drawn as the first need not be drawn again.
 *
 * @param {{left: number, width: number, top: number, height: number,
 *   position: string, edges: {top: string, bottom: string}}} a
 * @param {{left: number, width: number, top: number, height: number,
 *   position: string, edges: {top: string, bottom: string}}} b
 * @returns {boolean}
 */
export function samePlace(a, b) {
  return a.left === b.left && a.width === b.width && a.top === b.top && a.height === b.height
    && a.position === b.position && a.edges.top === b.edges.top && a.edges.bottom === b.edges.bottom
}

/**
 * Which child of wavesurfer.js's wrapper is the Spectrogram plugin's element,
 * from what each child is: whether it has a part name, whether it is laid over
 * the rest, and whether it holds a canvas. The element has no part name and is
 * not laid over the rest. Where more than one child has neither, it is the one
 * holding a canvas. It may hold none yet, as it does when it first says it is
 * ready, so the one candidate is the element whether or not it has drawn.
 *
 * @param {{part: boolean, absolute: boolean, canvas: boolean}[]} children
 * @returns {number} the index of the element, or -1 where none is singled out
 */
export function spectrogramChild(children) {
  const candidates = []
  children.forEach((child, index) => {
    if (!child.part && !child.absolute) candidates.push(index)
  })
  if (candidates.length === 1) return candidates[0]
  const drawn = candidates.filter((index) => children[index].canvas)
  return drawn.length === 1 ? drawn[0] : -1
}

/**
 * The row of a waveform split by channel that a region of the given index is
 * on: the rows some height, counted from 0. A channel hidden by splitChannels
 * has no height, and takes no row.
 *
 * @param {{top: number, height: number}[]} rows every channel's row, shown or not
 * @param {number} index the row to find, among those shown
 * @returns {{top: number, height: number}|null} null where there is no such row
 */
export function shownRow(rows, index) {
  const shown = rows.filter((row) => row.height > 0)
  if (!(index >= 0 && index < shown.length)) return null
  return { top: shown[index].top, height: shown[index].height }
}

/**
 * Whether an annotation is shown where the given channels are: on every one
 * when it names no channel, and where none are known; otherwise where its own
 * channel is one of them.
 *
 * @param {number|null} channel the annotation's channel, or null for none
 * @param {number[]|null} channels the channels shown, or null where not known
 * @returns {boolean}
 */
export function onChannels(channel, channels) {
  if (channel === null || channel === undefined || !channels) return true
  return channels.indexOf(channel) >= 0
}
