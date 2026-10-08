import terser from '@rollup/plugin-terser'

// wavesurfer.js is always the page's own: the plugin extends its BasePlugin
// rather than carrying a copy
const external = (id) => id === 'wavesurfer.js' || id.startsWith('wavesurfer.js/')

export default [
  // ESM, for bundlers
  {
    input: 'src/annotations.js',
    external: external,
    output: { file: 'dist/annotations.js', format: 'es' },
  },
  // UMD, for a <script> tag after wavesurfer.js's: it takes the page's
  // WaveSurfer, and attaches itself to it as WaveSurfer.Annotations
  {
    input: 'src/umd.js',
    external: external,
    output: {
      file: 'dist/annotations.min.js',
      format: 'umd',
      name: 'WaveSurfer.Annotations',
      extend: true,
      exports: 'default',
      globals: { 'wavesurfer.js': 'WaveSurfer' },
      plugins: [terser()],
    },
  },
]
