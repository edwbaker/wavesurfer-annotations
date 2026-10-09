// The demo: a xeno-canto recording and its annotations, from the audioBLAST!
// API, in whichever wavesurfer.js version and build of the plugin is asked for.
// Settings are in the page's address, so that every combination can be linked.

const API = 'https://api.audioblast.org'
const PRESETS = [
  { id: '1017836', title: 'Orthoptera at 192 kHz: regions up to 96 kHz' },
  { id: '1048144', title: 'Noctule bat at 192 kHz' },
  { id: '1154640', title: 'Reed warbler: 94 regions in 57 s' },
  { id: '1110764', title: 'Raven: regions from 0 Hz, one up to the top' },
  { id: '14208', title: 'Corpus: a region that is a point' },
  { id: '462812', title: 'Corpus: a region from below 0 Hz' },
]
const COLORS = { 'xeno-canto': 'rgb(255, 140, 0)' }
const OTHER_COLOR = 'rgb(0, 160, 255)'

const params = new URLSearchParams(location.search)
const version = /^[78]\.\d+\.\d+$/.test(params.get('ws') || '') ? params.get('ws') : '7.10.1'
const build = params.get('build') === 'dist' ? 'dist' : 'src'
const other = (params.get('other') || '').trim()
const xc = /^\d+$/.test(other) ? other : /^\d+$/.test(params.get('xc') || '') ? params.get('xc') : PRESETS[0].id
const fmax = Number(params.get('fmax')) || 0
const withRegions = params.has('xc') ? params.get('regions') === 'on' : true

const form = document.getElementById('controls')
const status = document.getElementById('status')
const zoom = document.getElementById('zoom')

PRESETS.forEach((preset) => form.xc.append(new Option('XC' + preset.id + ': ' + preset.title, preset.id)))
form.xc.value = PRESETS.some((preset) => preset.id === xc) ? xc : PRESETS[0].id
form.other.value = PRESETS.some((preset) => preset.id === xc) ? '' : xc
form.ws.value = version
form.build.value = build
form.fmax.value = fmax ? String(fmax) : ''
form.regions.checked = withRegions
zoom.disabled = true

function say(text, isError) {
  status.textContent = text
  status.className = isError ? 'error' : ''
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load ' + src))
    document.head.appendChild(script)
  })
}

async function get(path, query) {
  const response = await fetch(API + path + '?' + new URLSearchParams(Object.assign({ output: 'JSON' }, query)))
  if (!response.ok) throw new Error('The audioBLAST! API answered ' + response.status + ' for ' + path)
  return (await response.json()).data || []
}

// Only web addresses become links: the API's text is shown, never run
function safeHref(address) {
  try {
    const url = new URL(address)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch (error) {
    return null
  }
}

function link(text, address) {
  const href = safeHref(address)
  if (!href) return document.createTextNode(text)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.textContent = text
  anchor.target = '_blank'
  anchor.rel = 'noopener'
  return anchor
}

function line() {
  const div = document.createElement('div')
  div.append.apply(div, arguments)
  return div
}

function khz(hz) {
  return hz === null ? '…' : hz >= 1000 || hz <= -1000 ? (hz / 1000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + ' kHz' : Math.round(hz) + ' Hz'
}

// The frequency axis, from the plugin's view of the spectrogram on screen, so
// that it and the boxes always agree
function drawAxis(view) {
  const canvas = document.getElementById('axis')
  if (!view) {
    canvas.style.display = 'none'
    return
  }
  const ratio = window.devicePixelRatio || 1
  Object.assign(canvas.style, { display: 'block', top: view.top + 'px', height: view.height + 'px' })
  canvas.width = Math.round(52 * ratio)
  canvas.height = Math.round(view.height * ratio)
  const context = canvas.getContext('2d')
  context.scale(ratio, ratio)
  context.font = '10px system-ui, sans-serif'
  context.textAlign = 'right'
  context.fillStyle = '#4a4f59'
  const span = view.max - view.min
  const rough = span / Math.max(1, view.height / 28)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = magnitude * ([1, 2, 2.5, 5, 10].find((n) => n * magnitude >= rough) || 10)
  for (let f = Math.ceil(view.min / step) * step; f <= view.max + step * 1e-6; f += step) {
    const y = ((view.max - f) / span) * view.height
    context.fillRect(44, Math.round(y), 8, 1)
    const label = f >= 1000 ? +(f / 1000).toFixed(2) + 'k' : String(Math.round(f))
    context.fillText(label, 41, Math.min(view.height - 2, Math.max(9, y + 3)))
  }
}

function choose(id) {
  document.querySelectorAll('#list tr').forEach((row) => row.classList.toggle('chosen', row.dataset.id === id))
}

function listAnnotations(shown, ws) {
  const list = document.getElementById('list')
  shown.slice().sort((a, b) => a.start - b.start).forEach((annotation) => {
    const row = document.createElement('tr')
    row.dataset.id = annotation.id
    const cells = [
      annotation.label || '—',
      annotation.start.toFixed(3) + '–' + annotation.end.toFixed(3),
      annotation.low === null && annotation.high === null ? 'time only' : khz(annotation.low) + ' to ' + khz(annotation.high),
      annotation.data.source || '',
    ]
    cells.forEach((text, i) => {
      const cell = document.createElement('td')
      cell.textContent = text
      if (i === 1 || i === 2) cell.className = 'number'
      row.append(cell)
    })
    row.addEventListener('click', () => {
      ws.setTime(annotation.start)
      choose(annotation.id)
    })
    list.append(row)
  })
}

// Who made the recording and the annotations, under what licences
async function showCredits(recording, rows) {
  const credits = document.getElementById('credits')
  credits.textContent = ''
  credits.append(line('Recording: ', link('XC' + xc, 'https://xeno-canto.org/' + xc), ' ',
    recording.taxon || recording.name || '', ', by ', recording.author || 'someone not named', ', ',
    recording.license ? link('licence', recording.license) : 'licence not given'))
  // One line for each annotation set or corpus
  const groups = new Map()
  rows.forEach((row) => {
    const key = row.source + ' ' + (row.annotation_info_url || '')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  })
  for (const group of groups.values()) {
    const first = group[0]
    const annotators = Array.from(new Set(group.map((row) => row.annotator).filter(Boolean))).join('; ')
    const div = line(group.length + ' annotation' + (group.length === 1 ? '' : 's') + ' by ' + (annotators || 'someone not named') + ' (' + first.source + ')')
    credits.append(div)
    try {
      const details = await get('/data/details/', { type: 'annomate', record_source: first.source, id: first.annotation_id })
      const name = details.find((detail) => detail.name === 'set_name')
      const licence = details.find((detail) => detail.name === 'set_license')
      if (name) div.append(': ', link(name.value, first.annotation_info_url))
      if (licence) div.append(', ' + licence.value)
      if (!name) {
        const reference = (await get('/data/references/', { source: first.source }))[0]
        if (reference) {
          const terms = /Licence: ([^.]+)\./.exec(reference.note || '')
          div.append(': ', link(reference.author + ' (' + reference.year + ') ' + reference.title, reference.url || first.annotation_info_url),
            terms ? ', ' + terms[1] : '')
        }
      }
    } catch (error) {
      // Credits beyond the annotators are a nicety: the API may not have them
    }
  }
}

async function main() {
  say('Loading wavesurfer.js ' + version + '…')
  // From the audioBLAST! CDN, which has to have each version the form offers
  const base = 'https://cdn.audioblast.org/wavesurfer/' + version + '/'
  await loadScript(base + 'wavesurfer.min.js')
  await Promise.all(['regions', 'spectrogram', 'timeline'].map((name) => loadScript(base + 'plugins/' + name + '.min.js')))
  let Annotations
  if (build === 'dist') {
    await loadScript('../dist/annotations.min.js').catch(() => {
      throw new Error('There is no dist build: run npm run build')
    })
    Annotations = WaveSurfer.Annotations
  } else {
    Annotations = (await import('../src/annotations.js')).default
  }

  say('Fetching XC' + xc + ' and its annotations from the audioBLAST! API…')
  const [recordings, rows] = await Promise.all([
    get('/data/recordings/', { source: 'xeno-canto', id: xc }),
    get('/data/annomate/', { recording_source: 'xeno-canto', source_id: xc, format: 'ac', page_size: 250 }),
  ])
  const recording = recordings[0]
  if (!recording) throw new Error('audioBLAST! has no xeno-canto recording ' + xc)
  showCredits(recording, rows)

  const regions = withRegions ? WaveSurfer.Regions.create() : null
  const spectrogram = WaveSurfer.Spectrogram.create(Object.assign(
    { height: 200, labels: false, scale: 'linear', colorMap: 'gray', gainDB: 40, rangeDB: 80 },
    fmax ? { frequencyMax: fmax } : {}))
  const annotations = Annotations.create({ regions: regions, spectrogram: spectrogram })
  const ws = WaveSurfer.create({
    container: '#player',
    height: 100,
    minPxPerSec: Number(zoom.value),
    // Decoded at the recording's own rate, so that the spectrogram reaches its top
    sampleRate: Number(recording.sample_rate) || 48000,
    waveColor: '#9aa0a8',
    progressColor: '#4a4f59',
    cursorColor: '#d33',
    plugins: [regions, WaveSurfer.Timeline.create({ height: 20 }), spectrogram, annotations].filter(Boolean),
  })
  // For looking into from the console
  window.demo = { ws: ws, annotations: annotations, spectrogram: spectrogram, regions: regions }

  annotations.on('view', drawAxis)
  annotations.on('annotation-clicked', (annotation) => choose(annotation.id))
  const shown = annotations.addAll(rows.map((row) => Object.assign({}, row, {
    id: row.source + ':' + row.annotation_id,
    label: [row['dwc:scientificName'], row.type].filter(Boolean).join(', '),
    color: COLORS[row.source] || OTHER_COLOR,
  })))
  listAnnotations(shown, ws)
  const boxed = shown.filter((annotation) => annotation.low !== null || annotation.high !== null).length

  ws.on('error', (error) => say('wavesurfer.js could not play XC' + xc + ': ' + ((error && error.message) || error), true))
  ws.on('ready', () => {
    zoom.disabled = false
    say('XC' + xc + ': ' + shown.length + ' annotations, ' + boxed + ' of them bounded in frequency. wavesurfer.js '
      + version + ', the plugin\'s ' + (build === 'dist' ? 'dist build' : 'source') + '.')
  })
  zoom.addEventListener('input', () => ws.zoom(Number(zoom.value)))
  say('Downloading and decoding XC' + xc + ' at ' + (recording.sample_rate || 'its own') + ' Hz…')
  const loading = ws.load(safeHref(recording.filename))
  if (loading && loading.catch) loading.catch(() => {})
}

main().catch((error) => say(error.message, true))
