import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withAlpha } from '../src/color.js'
import { describe, formatHz, formatSeconds } from '../src/format.js'

test('seconds are given to the hundredth under a minute, without trailing zeros', () => {
  assert.equal(formatSeconds(0.1568), '0.16')
  assert.equal(formatSeconds(2), '2')
  assert.equal(formatSeconds(2.5), '2.5')
  assert.equal(formatSeconds(90.4), '90.4')
  assert.equal(formatSeconds(120), '120')
})

test('frequencies are given in Hz below 1 kHz and in kHz to three figures above', () => {
  assert.equal(formatHz(0), '0 Hz')
  assert.equal(formatHz(519), '519 Hz')
  assert.equal(formatHz(1443.84), '1.44 kHz')
  assert.equal(formatHz(9826), '9.83 kHz')
  assert.equal(formatHz(20428), '20.4 kHz')
  assert.equal(formatHz(96000), '96 kHz')
  assert.equal(formatHz(100000), '100 kHz')
  assert.equal(formatHz(110250), '110 kHz')
})

test('an annotation is described by its label, time and frequencies', () => {
  assert.equal(describe({ label: 'Song', start: 0.16, end: 9.1, low: 2734.03, high: 8152.82 }), 'Song, 0.16–9.1 s, 2.73 kHz to 8.15 kHz')
  assert.equal(describe({ label: '', start: 1, end: 2, low: 500, high: null }), '1–2 s, 500 Hz to …')
  assert.equal(describe({ label: 'Call', start: 1, end: 2, low: null, high: null }), 'Call, 1–2 s')
  assert.equal(describe({ label: 'Click', start: 1.5, end: 1.5, low: null, high: null }), 'Click, 1.5 s')
})

test('colours are given another opacity, or null where they cannot be read', () => {
  assert.equal(withAlpha('#f80', 0.5), 'rgba(255, 136, 0, 0.5)')
  assert.equal(withAlpha('#ff8800', 0.2), 'rgba(255, 136, 0, 0.2)')
  assert.equal(withAlpha('#ff880080', 0.2), 'rgba(255, 136, 0, 0.2)')
  assert.equal(withAlpha('rgb(255, 140, 0)', 0.12), 'rgba(255, 140, 0, 0.12)')
  assert.equal(withAlpha('rgba(1,2,3,0.4)', 1), 'rgba(1, 2, 3, 1)')
  assert.equal(withAlpha('rgb(1 2 3)', 0.5), 'rgba(1, 2, 3, 0.5)')
  for (const unreadable of ['orange', '', null, 'rgb(300, 0, 0)', '#12345']) assert.equal(withAlpha(unreadable, 0.5), null)
})
