// A static file server for the demo, with no dependencies: serves this
// repository (so the demo can reach src/ and dist/) on port 8802, or the port
// given as the first argument or in PORT.
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.argv[2] || process.env.PORT || 8802)
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
}

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  let file = normalize(join(root, path))
  if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return }
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html')
    const size = statSync(file).size
    // No caching, so that a page reloaded after an edit gets the edited files
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': size, 'Cache-Control': 'no-store' })
    createReadStream(file).pipe(response)
  } catch {
    response.writeHead(404).end()
  }
}).listen(port, () => console.log(`Demo at http://localhost:${port}/demo/`))
