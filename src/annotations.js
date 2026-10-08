/**
 * Annotations plugin for wavesurfer.js.
 *
 * Shows the annotations of a recording. Each one's span of time is a region on
 * the waveform, made with wavesurfer.js's own Regions plugin; one bounded in
 * frequency as well is also a box on the spectrogram, whether that is
 * wavesurfer.js's Spectrogram plugin or wavesurfer-tiled-spectrogram's tiles.
 *
 * Boxes are placed in time as shares of the recording, as regions are, so they
 * follow scroll and zoom without being moved, and in frequency by the range the
 * spectrogram on screen shows, which they follow when it changes: when tiles
 * hand over to the Spectrogram plugin, say.
 *
 * It runs in the browsers wavesurfer.js 7 runs in without a transpiler, so it
 * has no class fields and no `??=`.
 */
import WaveSurfer from 'wavesurfer.js'
import { withAlpha } from './color.js'
import { describe } from './format.js'
import { boxLayout, isBoxed, normaliseAnnotation, toNumber } from './geometry.js'

const BasePlugin = WaveSurfer && WaveSurfer.BasePlugin
if (!BasePlugin) throw new Error('wavesurfer-annotations needs wavesurfer.js 7.10.1 or later, loaded before it')

const DEFAULTS = {
  /** A Regions plugin, to show each annotation's span of time on the waveform */
  regions: null,
  /** The spectrogram the boxes are drawn on: see setSpectrogram() */
  spectrogram: null,
  /** Colour of an annotation that has none of its own */
  color: 'rgb(255, 140, 0)',
  /** Whether to show annotations' labels */
  labels: true,
  /** Pixels a box is at least, either way */
  minSize: 3,
  /** Whether boxes answer to the mouse (hover and click) */
  interactive: true,
}

// Which of a spectrogram's edges is drawn how: its own bound solid, a bound
// beyond what is shown dashed, and no bound at all not drawn
const EDGE_STYLES = { bound: 'solid', clipped: 'dashed', open: 'none' }

// Pixels a box must be across to show its label, cut to fit; a narrower one
// gives it only in its tooltip
const LABEL_MIN_WIDTH = 40

/**
 * The Spectrogram plugin's element in wavesurfer.js's wrapper, which the
 * plugin does not name. In wavesurfer.js 7 it is the plugin's `wrapper`; in 8
 * it is the one element in the wrapper that holds a canvas, has no part name
 * and is not laid over the rest.
 */
function findSpectrogramElement(spectrogram, wrapper) {
  if (spectrogram.wrapper instanceof HTMLElement && spectrogram.wrapper.parentElement === wrapper) {
    return spectrogram.wrapper
  }
  const found = Array.prototype.filter.call(wrapper.children, (child) =>
    !child.hasAttribute('part') && child.querySelector('canvas') && getComputedStyle(child).position !== 'absolute')
  return found.length === 1 ? found[0] : null
}

// A view as the page is given it, without the plugin's own workings
function plainView(view) {
  return view ? { min: view.min, max: view.max, scale: view.scale, top: view.top, height: view.height } : null
}

class AnnotationsPlugin extends BasePlugin {
  /**
   * @param {object} [options]
   * @param {object} [options.regions] a Regions plugin, to show each
   *   annotation's span of time on the waveform
   * @param {object|object[]} [options.spectrogram] the spectrogram the boxes
   *   are drawn on (see setSpectrogram())
   * @param {Function} [options.frequencyView] instead of `spectrogram`, a
   *   function giving what the spectrogram shows and where:
   *   `{min, max, scale, element}` or `{min, max, scale, top, height}`
   * @param {string} [options.color] colour of an annotation without one
   * @param {boolean} [options.labels] whether to show labels (true)
   * @param {number} [options.minSize] pixels a box is at least (3)
   * @param {boolean} [options.interactive] whether boxes answer to the mouse
   */
  static create(options) {
    return new AnnotationsPlugin(options || {})
  }

  constructor(options) {
    super(Object.assign({}, DEFAULTS, options))
    this.annotations = new Map()
    this.boxes = new Map()
    this.regions = new Map()
    this.spectrograms = []
    this.spectrogramSubscriptions = []
    // Spectrogram plugins that have said they are ready, so should be drawn
    this.drawn = new WeakSet()
    this.layer = null
    this.layoutTimer = null
    this.resizeObserver = null
    this.lastView = null
    this.warned = {}
    this.nextId = 1
    this.gone = false
  }

  onInit() {
    const ws = this.wavesurfer
    if (!ws) throw new Error('WaveSurfer is not initialised')
    const layer = document.createElement('div')
    layer.setAttribute('part', 'annotations')
    Object.assign(layer.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '0',
      overflow: 'hidden',
      zIndex: '5',
      pointerEvents: 'none',
      display: 'none',
    })
    this.layer = layer
    ws.getWrapper().appendChild(layer)

    const relayout = () => this.scheduleLayout()
    this.subscriptions.push(
      ws.on('decode', relayout),
      ws.on('ready', relayout),
      ws.on('redraw', relayout),
      ws.on('redrawcomplete', relayout),
      ws.on('zoom', relayout),
      // wavesurfer.js 8 only; 7 redraws on a resize
      ws.on('resize', relayout),
    )
    // The spectrogram moves down as the timeline above it fills, and grows
    // when the Spectrogram plugin draws, which no event says
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(relayout)
      this.resizeObserver.observe(ws.getWrapper())
    }
    this.setSpectrogram(this.options.spectrogram)
  }

  /**
   * Shows an annotation, or replaces the one with its id. Its bounds are
   * `start` and `end`, in seconds from the start of the recording, and `low`
   * and `high`, in Hz, either of which may be missing; or the same under their
   * Audiovisual Core names (`ac:startTime`, `ac:endTime`, `ac:freqLow`,
   * `ac:freqHigh`). It may have an `id`, a `label` and a `color`.
   *
   * @param {object} annotation
   * @returns {object|null} the annotation as the plugin keeps it, with the one
   *   given as its `data`; null, with a warning, where it has no start
   */
  add(annotation) {
    const kept = normaliseAnnotation(annotation, 'annotation-' + this.nextId++)
    if (!kept) {
      this.warnOnce('start', 'An annotation without a start time is not shown')
      return null
    }
    if (this.annotations.has(kept.id)) this.remove(kept.id)
    this.annotations.set(kept.id, kept)
    this.scheduleLayout()
    return kept
  }

  /**
   * Shows a list of annotations (see add()).
   *
   * @param {object[]} annotations
   * @returns {object[]} those shown, as the plugin keeps them
   */
  addAll(annotations) {
    return (annotations || []).map((annotation) => this.add(annotation)).filter(Boolean)
  }

  /** Stops showing the annotation with this id */
  remove(id) {
    const key = String(id)
    const box = this.boxes.get(key)
    if (box) box.remove()
    this.boxes.delete(key)
    const region = this.regions.get(key)
    if (region) {
      try { region.remove() } catch (error) { /* already gone with its plugin */ }
    }
    this.regions.delete(key)
    this.annotations.delete(key)
  }

  /** Stops showing every annotation */
  clear() {
    Array.from(this.annotations.keys()).forEach((id) => this.remove(id))
  }

  /** The annotations shown, as the plugin keeps them */
  getAnnotations() {
    return Array.from(this.annotations.values())
  }

  /**
   * The spectrogram the boxes are drawn on: wavesurfer.js's Spectrogram
   * plugin, a TiledSpectrogram, or both in a list, where the tiles stand in
   * for the Spectrogram plugin until they hand over to it. The boxes follow
   * whichever is on screen. Only a linear frequency scale is supported.
   *
   * @param {object|object[]|null} spectrogram
   */
  setSpectrogram(spectrogram) {
    this.spectrogramSubscriptions.forEach((unsubscribe) => unsubscribe())
    this.spectrogramSubscriptions = []
    this.spectrograms = (Array.isArray(spectrogram) ? spectrogram : [spectrogram]).filter(Boolean)
    const relayout = () => this.scheduleLayout()
    this.spectrograms.forEach((plugin) => {
      if (typeof plugin.on !== 'function') return
      const ready = () => {
        this.drawn.add(plugin)
        relayout()
      }
      // The Spectrogram plugin says 'ready'; tiles say 'load' and 'handover' too
      this.spectrogramSubscriptions.push(plugin.on('ready', ready), plugin.on('load', relayout), plugin.on('handover', relayout))
    })
    this.scheduleLayout()
  }

  /**
   * What the spectrogram on screen shows, and where: `{min, max, scale}` in Hz,
   * and its `top` and `height` in pixels within wavesurfer.js's wrapper. A page
   * can draw its frequency axis from it, so that the axis and the boxes always
   * agree; the 'view' event says when it changes.
   *
   * @returns {{min: number, max: number, scale: string, top: number, height: number}|null}
   *   null where there is no spectrogram, or none drawn yet
   */
  getFrequencyView() {
    return plainView(this.currentView())
  }

  currentView() {
    const ws = this.wavesurfer
    if (!ws) return null
    if (typeof this.options.frequencyView === 'function') return this.measure(this.options.frequencyView())
    const views = this.spectrograms.map((plugin) => this.viewOf(plugin)).filter((view) => view && view.height > 0)
    // A drawn Spectrogram plugin is on top of any tiles it took over from
    return views.filter((view) => view.kind === 'spectrogram')[0] || views[0] || null
  }

  // A view's position, from its element where it has one
  measure(view) {
    if (!view) return null
    const element = view.element
    return {
      kind: view.kind || 'given',
      min: toNumber(view.min) || 0,
      max: toNumber(view.max),
      scale: view.scale || 'linear',
      top: element ? element.offsetTop : toNumber(view.top) || 0,
      height: element ? element.offsetHeight : toNumber(view.height) || 0,
    }
  }

  viewOf(plugin) {
    const ws = this.wavesurfer
    const wrapper = ws.getWrapper()
    if (typeof plugin.getFrequencyRange === 'function') {
      // wavesurfer-tiled-spectrogram, whose element is named as a part
      const range = plugin.getFrequencyRange()
      const manifest = typeof plugin.getManifest === 'function' ? plugin.getManifest() : null
      const element = wrapper.querySelector('[part~="tiled-spectrogram"]')
      if (!range || !element) return null
      return this.measure({ kind: 'tiles', element: element, min: range.min, max: range.max,
        scale: (manifest && manifest.frequencyScale) || 'linear' })
    }
    // wavesurfer.js's Spectrogram plugin, which shows the decoded audio from
    // frequencyMin to frequencyMax, by default 0 Hz to half its sample rate,
    // on a mel scale unless told otherwise
    const decoded = ws.getDecodedData()
    if (!decoded) return null
    const element = findSpectrogramElement(plugin, wrapper)
    if (!element) {
      // Before it has drawn, wavesurfer.js 8's has no canvas to be known by
      if (this.drawn.has(plugin)) {
        this.warnOnce('element', 'The Spectrogram plugin\'s element could not be found; give the frequencyView option')
      }
      return null
    }
    const options = plugin.options || {}
    return this.measure({ kind: 'spectrogram', element: element, min: options.frequencyMin,
      max: toNumber(options.frequencyMax) || decoded.sampleRate / 2, scale: options.scale || 'mel' })
  }

  /**
   * Lays the annotations out again soon, once however many changes arrive in
   * the meantime. A timer rather than an animation frame, which a page in the
   * background may never be given.
   */
  scheduleLayout() {
    if (this.layoutTimer || this.gone) return
    this.layoutTimer = setTimeout(() => {
      this.layoutTimer = null
      this.layout()
    }, 30)
  }

  layout() {
    const ws = this.wavesurfer
    if (this.gone || !ws || !this.layer) return
    const duration = ws.getDuration()
    // Nothing can be placed in time until wavesurfer.js knows the duration
    if (!(duration > 0)) return
    this.annotations.forEach((annotation) => this.linkRegion(annotation))
    this.confineRegions()

    const view = this.currentView()
    this.emitView(view)
    if (!view || !(view.max > view.min) || !(view.height > 0)) {
      this.layer.style.display = 'none'
      return
    }
    if (view.scale !== 'linear') {
      this.warnOnce('scale', 'Boxes are drawn only on a linear frequency scale, not ' + view.scale
        + "; give the Spectrogram plugin scale: 'linear'")
      this.layer.style.display = 'none'
      return
    }
    Object.assign(this.layer.style, { display: '', top: view.top + 'px', height: view.height + 'px' })
    const width = ws.getWrapper().offsetWidth
    this.annotations.forEach((annotation) => {
      const place = boxLayout(annotation, { min: view.min, max: view.max, height: view.height }, duration, this.options.minSize)
      if (!place) return
      this.placeBox(this.boxFor(annotation), annotation, place, (place.width / 100) * width)
    })
  }

  emitView(view) {
    const last = this.lastView
    const same = last && view && last.min === view.min && last.max === view.max && last.scale === view.scale
      && last.top === view.top && last.height === view.height
    if (same || (!last && !view)) return
    this.lastView = view
    this.emit('view', plainView(view))
  }

  colorOf(annotation) {
    return annotation.color || this.options.color
  }

  /** An annotation's region on the waveform, made once the duration is known */
  linkRegion(annotation) {
    const plugin = this.options.regions
    if (!plugin || typeof plugin.addRegion !== 'function' || this.regions.has(annotation.id)) return
    const color = withAlpha(this.colorOf(annotation), 0.2) || 'rgba(0, 0, 0, 0.1)'
    let region = null
    try {
      region = plugin.addRegion({
        id: annotation.id,
        start: annotation.start,
        end: annotation.end,
        color: color,
        drag: false,
        resize: false,
        // A boxed annotation is labelled on its box
        content: this.options.labels && !isBoxed(annotation) && annotation.label ? this.makeLabel(annotation.label) : undefined,
      })
    } catch (error) {
      this.warnOnce('regions', 'Regions could not be added (' + error.message + '); register the Regions plugin with the player too')
    }
    if (region) this.regions.set(annotation.id, region)
  }

  /**
   * Keeps the regions of boxed annotations to the waveform, so that they do
   * not cover their own boxes, as regions span all of wavesurfer.js's wrapper.
   * Regions bounded in time alone stay full height: all frequencies.
   */
  confineRegions() {
    const wrapper = this.wavesurfer.getWrapper()
    const canvases = wrapper.querySelector('[part~="canvases"]')
    const height = canvases ? canvases.offsetHeight : 0
    if (!(height > 0)) return
    this.regions.forEach((region, id) => {
      const annotation = this.annotations.get(id)
      if (annotation && isBoxed(annotation) && region.element) region.element.style.height = height + 'px'
    })
  }

  makeLabel(text) {
    const label = document.createElement('div')
    label.setAttribute('part', 'annotation-label')
    label.textContent = text
    Object.assign(label.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      // Cut to fit its box (or region), so that labels never run into each other
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      padding: '0 3px',
      fontSize: '10px',
      lineHeight: '14px',
      color: '#111',
      background: 'rgba(255, 255, 255, 0.8)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    })
    return label
  }

  /** An annotation's box, made the first time it is placed */
  boxFor(annotation) {
    let box = this.boxes.get(annotation.id)
    if (box) return box
    const color = this.colorOf(annotation)
    const fill = withAlpha(color, 0.12) || 'rgba(255, 140, 0, 0.12)'
    const strong = withAlpha(color, 0.3) || fill
    box = document.createElement('div')
    box.setAttribute('part', 'annotation')
    box.dataset.id = annotation.id
    Object.assign(box.style, {
      position: 'absolute',
      boxSizing: 'border-box',
      minWidth: this.options.minSize + 'px',
      borderWidth: '1px',
      borderColor: color,
      background: fill,
      pointerEvents: this.options.interactive ? 'auto' : 'none',
    })
    if (this.options.labels && annotation.label) box.appendChild(this.makeLabel(annotation.label))
    if (this.options.interactive) {
      // A click still reaches wavesurfer.js, which seeks to it
      box.addEventListener('click', (event) => this.emit('annotation-clicked', annotation, event))
      box.addEventListener('mouseenter', () => {
        box.style.background = strong
        this.emit('annotation-in', annotation)
      })
      box.addEventListener('mouseleave', () => {
        box.style.background = fill
        this.emit('annotation-out', annotation)
      })
    }
    this.boxes.set(annotation.id, box)
    this.layer.appendChild(box)
    return box
  }

  placeBox(box, annotation, place, pixels) {
    const offView = place.position !== 'inside'
    Object.assign(box.style, {
      left: place.left + '%',
      width: place.width + '%',
      top: place.top + 'px',
      height: place.height + 'px',
      borderLeftStyle: 'solid',
      borderRightStyle: 'solid',
      // A box beyond what is shown is a dashed strip along that edge
      borderTopStyle: offView ? 'dashed' : EDGE_STYLES[place.edges.top],
      borderBottomStyle: offView ? 'dashed' : EDGE_STYLES[place.edges.bottom],
    })
    const label = box.firstChild
    if (label) label.style.display = offView || pixels < LABEL_MIN_WIDTH ? 'none' : ''
    box.title = describe(annotation) + (offView ? ' (' + place.position + ' the frequencies shown)' : '')
  }

  warnOnce(key, message) {
    if (this.warned[key]) return
    this.warned[key] = true
    console.warn('wavesurfer-annotations: ' + message)
  }

  destroy() {
    this.gone = true
    clearTimeout(this.layoutTimer)
    if (this.resizeObserver) this.resizeObserver.disconnect()
    this.spectrogramSubscriptions.forEach((unsubscribe) => unsubscribe())
    this.spectrogramSubscriptions = []
    this.regions.forEach((region) => {
      try { region.remove() } catch (error) { /* already gone with its plugin */ }
    })
    this.regions.clear()
    this.boxes.clear()
    if (this.layer) this.layer.remove()
    this.layer = null
    super.destroy()
  }
}

export default AnnotationsPlugin
export { normaliseAnnotation, boxLayout, timeLayout, frequencyToY } from './geometry.js'
