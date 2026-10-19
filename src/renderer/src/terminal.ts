// A tiny terminal screen model: enough of ANSI for the `skills` CLI (colors, spinners that
// rewrite their line with `ESC[1G` / `\r` and `ESC[J`). Not a general emulator.

export interface Style {
  fg?: number
  bg?: number
  bold?: boolean
  dim?: boolean
}

export interface Cell {
  ch: string
  style: Style
}

export interface Term {
  lines: Cell[][]
  row: number
  col: number
  style: Style
  /** Unfinished escape sequence from the previous chunk. */
  pending: string
}

const MAX_LINES = 2000

export const newTerm = (): Term => ({ lines: [[]], row: 0, col: 0, style: {}, pending: '' })

function applySgr(style: Style, params: number[]): Style {
  let s = { ...style }
  for (let i = 0; i < params.length; i++) {
    const p = params[i]
    if (p === 0) s = {}
    else if (p === 1) s.bold = true
    else if (p === 2) s.dim = true
    else if (p === 22) s.bold = s.dim = false
    else if (p >= 30 && p <= 37) s.fg = p - 30
    else if (p >= 90 && p <= 97) s.fg = p - 90 + 8
    else if (p === 39) s.fg = undefined
    else if (p >= 40 && p <= 47) s.bg = p - 40
    else if (p >= 100 && p <= 107) s.bg = p - 100 + 8
    else if (p === 49) s.bg = undefined
    else if (p === 38 || p === 48) i += params[i + 1] === 5 ? 2 : params[i + 1] === 2 ? 4 : 0
  }
  return s
}

function put(t: Term, ch: string): void {
  const line = t.lines[t.row]
  while (line.length < t.col) line.push({ ch: ' ', style: {} })
  line[t.col] = { ch, style: t.style }
  t.col++
}

function csi(t: Term, params: string, final: string): void {
  const nums = params.replace(/^\?/, '').split(';').map((n) => parseInt(n, 10))
  const n = Number.isNaN(nums[0]) ? undefined : nums[0]
  switch (final) {
    case 'm':
      t.style = applySgr(t.style, Number.isNaN(nums[0]) ? [0] : nums)
      break
    case 'G':
      t.col = Math.max(0, (n ?? 1) - 1)
      break
    case 'K':
      if (n === 2) t.lines[t.row] = []
      else t.lines[t.row].length = Math.min(t.lines[t.row].length, t.col)
      break
    case 'J':
      t.lines[t.row].length = Math.min(t.lines[t.row].length, t.col)
      if (n !== 1) t.lines.length = t.row + 1
      break
    case 'A':
      t.row = Math.max(0, t.row - (n ?? 1))
      break
    case 'B':
      t.row = Math.min(t.lines.length - 1, t.row + (n ?? 1))
      break
    case 'C':
      t.col += n ?? 1
      break
    case 'D':
      t.col = Math.max(0, t.col - (n ?? 1))
      break
  }
}

/** Feed output into the screen. Mutates and returns `t`. */
export function writeTerm(t: Term, chunk: string): Term {
  const text = t.pending + chunk
  t.pending = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\x1b') {
      const m = /^\x1b\[([0-9;?]*)([ -/]*[@-~])/.exec(text.slice(i, i + 40))
      if (m) {
        csi(t, m[1], m[2])
        i += m[0].length - 1
      } else if (i + 1 >= text.length || (text[i + 1] === '[' && text.length - i < 40)) {
        t.pending = text.slice(i)
        break
      }
    } else if (c === '\r') t.col = 0
    else if (c === '\n') {
      t.row++
      t.col = 0
      if (t.row >= t.lines.length) t.lines.push([])
    } else if (c >= ' ') put(t, c)
  }
  if (t.lines.length > MAX_LINES) {
    const drop = t.lines.length - MAX_LINES
    t.lines.splice(0, drop)
    t.row = Math.max(0, t.row - drop)
  }
  return t
}
