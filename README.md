# wavesurfer-annotations

A [wavesurfer.js](https://wavesurfer.xyz) plugin that shows the annotations of
a recording. Each annotation's span of time is a region on the waveform; one
bounded in frequency as well is also a box on the spectrogram.

See it in the [live demo](https://wavesurfer-annotations.acousti.cloud/demo/),
on xeno-canto recordings and their annotations from the audioBLAST! API.

wavesurfer.js's Regions plugin marks spans of time only. Annotations of animal
sounds, such as those made in Raven or on xeno-canto, usually bound a call in
frequency too, and are best shown as a box on the spectrogram. This plugin
draws those boxes, linked to regions on the waveform.

- **Boxes on the spectrogram:** placed by an annotation's times and
  frequencies, on wavesurfer.js's Spectrogram plugin or on
  [wavesurfer-tiled-spectrogram](https://github.com/edwbaker/wavesurfer-tiled-spectrogram)'s
  tiles. They follow scroll and zoom, and when tiles hand over to the
  Spectrogram plugin they move to the range it shows.
- **Regions on the waveform:** each annotation's span of time, made with
  wavesurfer.js's own Regions plugin. An annotation bounded in time alone is a
  region over everything, as it covers all frequencies; the region of one with
  a box is kept to the waveform, so as not to cover the box.
- **Any annotation, from anywhere:** bounds are given as `start`, `end`,
  `low` and `high`, or under their
  [Audiovisual Core](https://ac.tdwg.org/termlist/) names, as `ac:startTime`,
  `ac:endTime`, `ac:freqLow` and `ac:freqHigh`. A missing frequency bound is
  missing, not 0 Hz: the box runs to the edge of the spectrogram.
- **Nothing lost off the edge:** a bound beyond the frequencies shown is
  drawn dashed, and a box wholly above or below them is a strip along that edge.
- **One frequency axis:** the plugin says what range the spectrogram on screen
  shows, and where, so a page can draw its axis from the same figures as the
  boxes.
- **Small and dependency-free:** about 11 KB minified, and works with
  wavesurfer.js 7.10 and 8.

It shows annotations; it does not yet make or edit them.

## Installation

```sh
npm install wavesurfer-annotations
```

Or with a script tag, after wavesurfer.js's own and its plugins':

```html
<script src="https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.min.js"></script>
<script src="https://unpkg.com/wavesurfer.js@7/dist/plugins/regions.min.js"></script>
<script src="https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.min.js"></script>
<script src="https://unpkg.com/wavesurfer-annotations/dist/annotations.min.js"></script>
<!-- WaveSurfer.Annotations is now defined -->
```

The plugin extends wavesurfer.js's own `BasePlugin`, so it carries no copy of
wavesurfer.js: the ES module imports `wavesurfer.js`, and the script-tag build
uses the page's `WaveSurfer`.

## Usage

```js
import WaveSurfer from 'wavesurfer.js'
import Regions from 'wavesurfer.js/dist/plugins/regions.js'
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.js'
import Annotations from 'wavesurfer-annotations'

const regions = Regions.create()
const spectrogram = Spectrogram.create({ scale: 'linear', height: 200 })
const annotations = Annotations.create({ regions, spectrogram })

WaveSurfer.create({
  container: '#player',
  url: '/audio/rec1.wav',
  sampleRate: 48000, // the recording's own, so that the spectrogram reaches its top
  plugins: [regions, spectrogram, annotations],
})

annotations.addAll([
  { id: 'a1', start: 1.2, end: 1.9, low: 2400, high: 7800, label: 'Song' },
  { id: 'a2', start: 3.0, end: 3.4, low: 9000, label: 'Call, from 9 kHz up' },
  { id: 'a3', start: 5.1, end: 6.0, label: 'Noise, all frequencies' },
])
```

- **Spectrogram scale:** give the Spectrogram plugin `scale: 'linear'`. Its
  default is `'mel'`, which the plugin does not yet draw boxes on; it warns
  instead.
- **Frequencies:** wavesurfer.js decodes audio at its `sampleRate` option,
  8000 Hz unless it is set, and the Spectrogram plugin shows up to half that.
  Set it to the recording's own rate to see every annotation.
- **Regions:** pass a Regions plugin to see each annotation's span of time on
  the waveform; without one, only boxes are drawn.

### Annotations in Audiovisual Core

Regions of interest written in Audiovisual Core terms are taken as they are,
and an annotation's other fields are kept as its `data`:

```js
annotations.add({
  'dcterms:identifier': 'roi-17',
  'ac:startTime': '0.1568',
  'ac:endTime': '0.2998',
  'ac:freqLow': '9826',
  'ac:freqHigh': '96000',
  'dwc:scientificName': 'Platycleis albopunctata', // the label, unless one is given
})
```

### With tiles

With [wavesurfer-tiled-spectrogram](https://github.com/edwbaker/wavesurfer-tiled-spectrogram),
give both spectrograms: the boxes are drawn on the tiles until they hand over
to the Spectrogram plugin, and then on it.

```js
const tiles = TiledSpectrogram.create({ url: '/spectrograms/rec1/index.json' })
const spectrogram = Spectrogram.create({ scale: 'linear' })
const annotations = Annotations.create({ regions, spectrogram: [tiles, spectrogram] })
WaveSurfer.create({ container: '#player', url: '/audio/rec1.wav', plugins: [regions, tiles, spectrogram, annotations] })
tiles.handOver(spectrogram)
```

With tiles alone, as when the audio is streamed, give just the tiles.

### A frequency axis that agrees with the boxes

```js
annotations.on('view', (view) => {
  if (!view) return
  // view.min and view.max are in Hz; view.top and view.height are in pixels,
  // within the player: draw the axis beside them
  drawAxis(view.min, view.max, view.top, view.height)
})
```

## Options

| Option | Default | |
|---|---|---|
| `regions` | | A Regions plugin, to show each annotation's span of time on the waveform. |
| `spectrogram` | | The spectrogram to draw boxes on: a Spectrogram plugin, a TiledSpectrogram, or both in a list. |
| `frequencyView` | | Instead of `spectrogram`, a function giving `{min, max, scale, element}`, or `{min, max, scale, top, height}`, for any other spectrogram. |
| `color` | `'rgb(255, 140, 0)'` | Colour of an annotation without one. Hex and `rgb()` colours are used for fills too. |
| `labels` | `true` | Whether to show annotations' labels. A label may run on past a narrow box as far as the next box, where it is cut short, so labels never cover one another; with under 30 px of room it is left off. Every box gives its label in full in its tooltip. |
| `minSize` | `3` | Pixels a box is at least, either way, so that points and moments show. |
| `interactive` | `true` | Whether boxes answer to the mouse. |

## Annotations

| Field | |
|---|---|
| `start` or `ac:startTime` | Seconds from the start of the recording. Required. |
| `end` or `ac:endTime` | Seconds; the same as `start` if missing. |
| `low` or `ac:freqLow` | Hz; may be missing. |
| `high` or `ac:freqHigh` | Hz; may be missing. |
| `id` or `dcterms:identifier` | Adding an annotation with the id of one shown replaces it. |
| `label` or `dwc:scientificName` | Shown on the box, or on the region of an annotation without one. |
| `color` | Its colour. |

Numbers may be given as text, as many APIs give them. Bounds the wrong way
round are swapped.

## Methods

`add(annotation)`, `addAll(annotations)`, `remove(id)`, `clear()`,
`getAnnotations()`, `setSpectrogram(spectrogram)`, `getFrequencyView()`.

## Events

| Event | |
|---|---|
| `view` | The range the spectrogram on screen shows, or where it is, has changed; the listener is passed `{min, max, scale, top, height}`, or null. |
| `annotation-clicked` | A box was clicked; the listener is passed the annotation and the event. The click still seeks. |
| `annotation-in`, `annotation-out` | The mouse has moved onto or off a box. |

## Styling

The boxes are inside wavesurfer.js's shadow DOM. Style them with
`::part(annotations)` (the layer over the spectrogram), `::part(annotation)`
(each box) and `::part(annotation-label)`.

Labels' looks (font, colours, padding and `top`) come from a stylesheet the
plugin adds to the shadow DOM, which a page's own rules override:

```css
#player ::part(annotation-label) {
  top: 3px;
  font: 9px/1.5 monospace;
  background: rgba(250, 252, 250, 0.9);
}
```

Each box's colours are its annotation's, set on the box itself; override
those with `!important`.

## Limits

- Display only: annotations cannot yet be drawn or edited with the mouse.
- Linear frequency scales only.
- One spectrogram: not one per channel (`splitChannels`).

## Browser support

The same browsers as wavesurfer.js 7, without a transpiler: Chrome and Edge
80+, Firefox 74+, Safari 13.1+. CI checks the builds are ES2020.

## Development

```sh
npm install
npm test          # node --test
npm run build     # dist/: the ES module and the minified UMD build
npm run check     # ES2020 check of dist/
npm run serve     # the demo at http://localhost:8802/demo/
```

The demo shows xeno-canto recordings and their annotations from the
[audioBLAST! API](https://api.audioblast.org/), with wavesurfer.js 7 or 8, the
plugin's source or its build, and the spectrogram cut off at a frequency of
your choosing. It credits each recording and annotation set as the API gives
them.

## Licence

MIT. See [LICENSE](LICENSE).
