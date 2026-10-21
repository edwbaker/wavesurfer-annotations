import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shownRow, spectrogramChild } from '../src/geometry.js'

const part = { part: true, absolute: false, canvas: true }
const laid = { part: false, absolute: true, canvas: true }
const plain = { part: false, absolute: false, canvas: false }
const drawn = { part: false, absolute: false, canvas: true }

test('the Spectrogram plugin\'s element is the child with no part name that is not laid over the rest', () => {
  assert.equal(spectrogramChild([part, drawn, part]), 1)
  assert.equal(spectrogramChild([part, laid, plain, part]), 2)
})

test('it is found before it has drawn, when it holds no canvas yet', () => {
  assert.equal(spectrogramChild([part, part, plain, part]), 2)
})

test('where others have no part name either, it is the one holding a canvas', () => {
  assert.equal(spectrogramChild([part, plain, drawn]), 2)
  assert.equal(spectrogramChild([part, plain, plain]), -1)
  assert.equal(spectrogramChild([part, drawn, drawn]), -1)
})

test('with no child that is one, there is no element', () => {
  assert.equal(spectrogramChild([]), -1)
  assert.equal(spectrogramChild([part, laid]), -1)
})

test('a row is one of those shown, and a channel hidden by splitChannels takes none', () => {
  const rows = [{ top: 0, height: 0 }, { top: 0, height: 64 }, { top: 64, height: 64 }]
  assert.deepEqual(shownRow(rows, 0), { top: 0, height: 64 })
  assert.deepEqual(shownRow(rows, 1), { top: 64, height: 64 })
  assert.equal(shownRow(rows, 2), null)
  assert.equal(shownRow(rows, -1), null)
  assert.equal(shownRow([], 0), null)
})

test('a waveform that is not split is one row, the whole of it', () => {
  assert.deepEqual(shownRow([{ top: 0, height: 128 }], 0), { top: 0, height: 128 })
})
