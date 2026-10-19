import type { Board, BrowseData, BrowseResult, RegistryHit, RepoRow, SkillRow } from '@shared/types'

// skills.sh has a JSON API only for the leaderboard. Owner, repo and skill pages are
// server-rendered HTML, so those are read from the markup. That markup isn't a contract:
// when it stops matching, callers get an error and the UI offers to open the page instead.
const SITE = 'https://skills.sh'
const SEGMENT = /^[\w.-]+$/
const BOARDS: Board[] = ['all-time', 'trending', 'hot']

async function get(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (SkillsDashboard)', accept },
    signal: AbortSignal.timeout(15000)
  })
  if (res.status === 404) throw new Error('skills.sh has no page for this.')
  if (!res.ok) throw new Error(`skills.sh answered ${res.status}`)
  return res
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Inner HTML → plain text. Never returns markup, so it is safe to render as text. */
const text = (html: string): string =>
  decode(html.replace(/<!--.*?-->/gs, '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

/** "586.1K" → 586100 */
function count(label: string): number {
  const m = /^([\d.,]+)\s*([KkMmBb]?)$/.exec(label.trim())
  if (!m) return 0
  const n = parseFloat(m[1].replace(/,/g, ''))
  return Math.round(n * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] ?? 1))
}

async function board(name: Board, page: number): Promise<BrowseData> {
  if (!BOARDS.includes(name) || !Number.isInteger(page) || page < 0) throw new Error('Unknown leaderboard.')
  const body = (await (await get(`${SITE}/api/skills/${name}/${page}`, 'application/json')).json()) as {
    skills?: Partial<RegistryHit>[]
    hasMore?: boolean
  }
  const skills = (body.skills ?? [])
    .filter((s) => s.source && s.skillId)
    .map((s) => ({
      id: `${s.source}/${s.skillId}`,
      source: s.source!,
      skillId: s.skillId!,
      name: s.name ?? s.skillId!,
      installs: typeof s.installs === 'number' ? s.installs : 0
    }))
  // The trending list has no `hasMore` and always ends where the site ends it.
  return { level: 'board', skills, hasMore: body.hasMore ?? false }
}

interface Row {
  segment: string
  title: string
  detail: string
  installs: number
}

/** The rows of an owner or repo page: anchors one level below `path` that hold an <h3>. */
function rows(html: string, path: string[]): Row[] {
  const prefix = `/${path.join('/')}/`
  const seen = new Set<string>()
  const out: Row[] = []
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"?#]+)"[^>]*>(.*?)<\/a>/gs)) {
    const [, href, inner] = m
    if (!href.startsWith(prefix)) continue
    const segment = href.slice(prefix.length)
    if (!SEGMENT.test(segment) || seen.has(segment)) continue
    const title = /<h3\b[^>]*>(.*?)<\/h3>/s.exec(inner)
    if (!title) continue
    seen.add(segment)
    const detail = /<p\b[^>]*>(.*?)<\/p>/s.exec(inner)
    const spans = [...inner.matchAll(/<span\b[^>]*font-mono[^>]*>(.*?)<\/span>/gs)]
    out.push({
      segment,
      title: text(title[1]),
      detail: detail ? text(detail[1]) : '',
      installs: spans.length ? count(text(spans[spans.length - 1][1])) : 0
    })
  }
  return out
}

function skillPage(html: string): BrowseData {
  // Unknown skills get a 200 page that says so; real ones have a Summary and the SKILL.md.
  if (!html.includes('>Summary<') && !html.includes('>SKILL.md<'))
    throw new Error('That skill is not available in this repository.')
  // The topic tag sits right under the title; later /topic/ links belong to the page's sidebar.
  const top = Math.max(0, html.indexOf('<h1'))
  const topic = /<a\b[^>]*href="\/topic\/[^"]*"[^>]*>(.*?)<\/a>/s.exec(html.slice(top, top + 1500))
  const from = html.indexOf('>Summary<')
  const to = html.indexOf('>SKILL.md<')
  const summary: { bullet: boolean; text: string }[] = []
  if (from >= 0) {
    const part = html.slice(from, to > from ? to : from + 20000)
    for (const m of part.matchAll(/<(p|li)\b[^>]*>(.*?)<\/\1>/gs)) {
      const t = text(m[2])
      if (t) summary.push({ bullet: m[1] === 'li', text: t })
    }
  }
  return { level: 'skill', topic: topic ? text(topic[1]) : undefined, summary }
}

async function page(path: string[]): Promise<BrowseData> {
  const html = await (await get(`${SITE}/${path.join('/')}`, 'text/html')).text()
  if (path.length === 3) return skillPage(html)
  const found = rows(html, path)
  if (path.length === 1) {
    if (!found.length) throw new Error('No repositories found.')
    const repos: RepoRow[] = found.map((r) => ({ name: r.title, summary: r.detail, installs: r.installs }))
    return { level: 'owner', repos }
  }
  const skills: SkillRow[] = found.map((r) => ({ skillId: r.title, installs: r.installs }))
  if (!skills.length) throw new Error('No skills found.')
  return { level: 'repo', skills }
}

/** `[]` is the leaderboard; one segment is an owner, two a repo, three a skill. */
export async function browseRegistry(path: string[], boardName: Board, pageNo: number): Promise<BrowseResult> {
  try {
    if (path.length > 3 || !path.every((s) => SEGMENT.test(s))) throw new Error('Not a skills.sh address.')
    return { data: path.length === 0 ? await board(boardName, pageNo) : await page(path) }
  } catch (e) {
    const err = e as Error
    return { error: err.name === 'TimeoutError' ? 'skills.sh took too long to answer.' : err.message }
  }
}
