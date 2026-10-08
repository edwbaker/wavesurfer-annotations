import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boxLayout, frequencyToY, isBoxed, normaliseAnnotation, timeLayout, toNumber } from '../src/geometry.js'

test('numbers come from numbers or numeric text, and nothing else', () => {
  assert.equal(toNumber('2734.03'), 2734.03)
  assert.equal(toNumber(' 519 '), 519)
  assert.equal(toNumber(0), 0)
  assert.equal(toNumber('0'), 0)
  for (const missing of ['', '  ', null, undefined, 'abc', NaN, Infinity, {}]) assert.equal(toNumber(missing), null)
})

test('an annotation is read from its own names', () => {
  const kept = normaliseAnnotation({ id: 'a', start: 1, end: 2, low: 100, high: 200, label: 'Song', color: 'red' }, 'f')
  assert.deepEqual(
    { id: kept.id, start: kept.start, end: kept.end, low: kept.low, high: kept.high, label: kept.label, color: kept.color },
    { id: 'a', start: 1, end: 2, low: 100, high: 200, label: 'Song', color: 'red' })
})

test('and from Audiovisual Core names, as text, prefixed or not', () => {
  const ac = normaliseAnnotation({ 'ac:startTime': '0.1568', 'ac:endTime': '0.2998', 'ac:freqLow': '9826',
    'ac:freqHigh': '96000', 'dwc:scientificName': 'Platycleis albopunctata' }, 'f')
  assert.deepEqual([ac.start, ac.end, ac.low, ac.high, ac.label, ac.id], [0.1568, 0.2998, 9826, 96000, 'Platycleis albopunctata', 'f'])
  const bare = normaliseAnnotation({ startTime: 1, endTime: 2, freqLow: 3, freqHigh: 4 }, 'f')
  assert.deepEqual([bare.start, bare.end, bare.low, bare.high], [1, 2, 3, 4])
})

test('a missing frequency bound stays missing, and 0 Hz is a bound', () => {
  const timeOnly = normaliseAnnotation({ start: 1, end: 2 }, 'f')
  assert.equal(timeOnly.low, null)
  assert.equal(timeOnly.high, null)
  assert.equal(isBoxed(timeOnly), false)
  const fromZero = normaliseAnnotation({ start: 1, end: 2, low: 0 }, 'f')
  assert.equal(fromZero.low, 0)
  assert.equal(isBoxed(fromZero), true)
  const blank = normaliseAnnotation({ start: '1', end: '', low: '', high: '5000' }, 'f')
  assert.deepEqual([blank.start, blank.end, blank.low, blank.high], [1, 1, null, 5000])
})

test('bounds the wrong way round are swapped, and no end is a moment', () => {
  const kept = normaliseAnnotation({ start: 3, end: 1, low: 900, high: 100 }, 'f')
  assert.deepEqual([kept.start, kept.end, kept.low, kept.high], [1, 3, 100, 900])
  const moment = normaliseAnnotation({ start: 1.5 }, 'f')
  assert.equal(moment.end, 1.5)
})

test('an annotation without a start is refused, and one that is not an object throws', () => {
  assert.equal(normaliseAnnotation({ end: 2, low: 1, high: 2 }, 'f'), null)
  assert.throws(() => normaliseAnnotation(null, 'f'), TypeError)
  assert.throws(() => normaliseAnnotation('x', 'f'), TypeError)
})

test('ids are text, from id or dcterms:identifier, and the annotation given is kept as data', () => {
  assert.equal(normaliseAnnotation({ id: 74689, start: 0 }, 'f').id, '74689')
  assert.equal(normaliseAnnotation({ 'dcterms:identifier': 'roi-1', start: 0 }, 'f').id, 'roi-1')
  const given = { start: 0, extra: 'x' }
  assert.equal(normaliseAnnotation(given, 'f').data, given)
})

test('frequencies map linearly down the spectrogram', () => {
  assert.equal(frequencyToY(1000, 0, 1000, 100), 0)
  assert.equal(frequencyToY(0, 0, 1000, 100), 100)
  assert.equal(frequencyToY(250, 0, 1000, 100), 75)
  assert.equal(frequencyToY(1500, 1000, 2000, 100), 50)
})

test('time is placed as percentages of the duration, clamped to the recording', () => {
  assert.deepEqual(timeLayout(1, 2, 10), { left: 10, width: 10 })
  assert.deepEqual(timeLayout(-1, 20, 10), { left: 0, width: 100 })
  assert.equal(timeLayout(1, 2, 0), null)
})

const view = { min: 0, max: 10000, height: 100 }

test('a box in view is placed by its bounds', () => {
  const box = boxLayout({ start: 1, end: 2, low: 2000, high: 4000 }, view, 10)
  assert.equal(box.left, 10)
  assert.equal(box.width, 10)
  assert.equal(box.top, 60)
  assert.equal(box.height, 20)
  assert.equal(box.position, 'inside')
  assert.deepEqual(box.edges, { top: 'bound', bottom: 'bound' })
})

test('an annotation bounded in time alone has no box', () => {
  assert.equal(boxLayout({ start: 1, end: 2, low: null, high: null }, view, 10), null)
})

test('a missing bound runs to the edge, open', () => {
  const lowOnly = boxLayout({ start: 1, end: 2, low: 2000, high: null }, view, 10)
  assert.deepEqual([lowOnly.top, lowOnly.height, lowOnly.edges.top, lowOnly.edges.bottom], [0, 80, 'open', 'bound'])
  const highOnly = boxLayout({ start: 1, end: 2, low: null, high: 4000 }, view, 10)
  assert.deepEqual([highOnly.top, highOnly.height, highOnly.edges.top, highOnly.edges.bottom], [60, 40, 'bound', 'open'])
})

test('a bound beyond what is shown is clipped', () => {
  const tall = boxLayout({ start: 1, end: 2, low: 2000, high: 20000 }, view, 10)
  assert.deepEqual([tall.top, tall.height, tall.edges.top], [0, 80, 'clipped'])
  // As two of a corpus's regions have, below 0 Hz
  const negative = boxLayout({ start: 1, end: 2, low: -3724.64, high: 4000 }, view, 10)
  assert.deepEqual([negative.top, negative.height, negative.edges.bottom], [60, 40, 'clipped'])
})

test('a box wholly above or below what is shown is a strip along that edge', () => {
  const above = boxLayout({ start: 1, end: 2, low: 12000, high: 20000 }, view, 10)
  assert.deepEqual([above.position, above.top, above.height], ['above', 0, 3])
  const below = boxLayout({ start: 1, end: 2, low: 100, high: 500 }, { min: 1000, max: 10000, height: 100 }, 10)
  assert.deepEqual([below.position, below.top, below.height], ['below', 97, 3])
})

test('a point in frequency is drawn minSize high, centred, and kept on the spectrogram', () => {
  const point = boxLayout({ start: 1, end: 1.000023, low: 5000, high: 5000 }, view, 10)
  assert.deepEqual([point.top, point.height], [48.5, 3])
  const atTop = boxLayout({ start: 1, end: 2, low: 10000, high: 10000 }, view, 10)
  assert.deepEqual([atTop.top, atTop.height], [0, 3])
  const bigger = boxLayout({ start: 1, end: 2, low: 5000, high: 5000 }, view, 10, 5)
  assert.deepEqual([bigger.top, bigger.height], [47.5, 5])
})

test('nothing is placed without a view or a duration', () => {
  const annotation = { start: 1, end: 2, low: 2000, high: 4000 }
  assert.equal(boxLayout(annotation, { min: 5000, max: 5000, height: 100 }, 10), null)
  assert.equal(boxLayout(annotation, { min: 0, max: 10000, height: 0 }, 10), null)
  assert.equal(boxLayout(annotation, view, 0), null)
  assert.equal(boxLayout(annotation, null, 10), null)
})
