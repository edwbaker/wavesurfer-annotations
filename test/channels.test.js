import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseAnnotation, onChannels } from '../src/geometry.js'

test('an annotation names its channel, counted from 0, as a number or as text, or none', () => {
  assert.equal(normaliseAnnotation({ start: 1, channel: 1 }, 'f').channel, 1)
  assert.equal(normaliseAnnotation({ start: 1, channel: '0' }, 'f').channel, 0)
  assert.equal(normaliseAnnotation({ start: 1 }, 'f').channel, null)
  assert.equal(normaliseAnnotation({ start: 1, channel: '' }, 'f').channel, null)
})

test('an annotation that names no channel is on every channel, and one that names a channel is only on it', () => {
  assert.equal(onChannels(null, [0, 1]), true)
  assert.equal(onChannels(1, [0, 1]), true)
  assert.equal(onChannels(1, [0]), false)
  assert.equal(onChannels(0, [1]), false)
})

test('where no channels are known, every annotation is shown', () => {
  assert.equal(onChannels(1, null), true)
  assert.equal(onChannels(1, undefined), true)
})
