/**
 * Colours for annotations' boxes and regions. Pure functions, so that they can
 * be tested without a browser.
 */

// [r, g, b] from #rgb, #rrggbb or #rrggbbaa
function fromHex(value) {
  let hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value)
  if (!hex) return null
  hex = hex[1].length === 3 ? hex[1].replace(/./g, '$&$&') : hex[1]
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

// [r, g, b] from rgb() or rgba(), with commas or spaces
function fromRgb(value) {
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(value)
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null
}

/**
 * The same colour at another opacity, for the fills of boxes and regions
 * drawn in an annotation's colour. Takes hex (#rgb, #rrggbb, #rrggbbaa) and
 * rgb() or rgba(); for any other colour gives null, and the caller its own
 * fill.
 *
 * @param {string} color
 * @param {number} alpha from 0 to 1
 * @returns {string|null}
 */
export function withAlpha(color, alpha) {
  const value = String(color || '').trim()
  const rgb = fromHex(value) || fromRgb(value)
  if (!rgb || rgb.some((c) => !(c >= 0 && c <= 255))) return null
  return 'rgba(' + rgb.join(', ') + ', ' + alpha + ')'
}
