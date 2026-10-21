import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withAlpha } from '../src/color.js'

test('a colour keeps its channels and takes the given opacity', () => {
  assert.equal(withAlpha('rgb(255, 140, 0)', 0.2), 'rgba(255, 140, 0, 0.2)')
  assert.equal(withAlpha('rgba(255, 140, 0, 1)', 0.12), 'rgba(255, 140, 0, 0.12)')
  assert.equal(withAlpha('#ff8c00', 0.3), 'rgba(255, 140, 0, 0.3)')
  assert.equal(withAlpha('#f80', 0.3), 'rgba(255, 136, 0, 0.3)')
})

test('a colour it cannot read gives no fill, so that the caller uses its own', () => {
  assert.equal(withAlpha('orange', 0.2), null)
  assert.equal(withAlpha('', 0.2), null)
})
