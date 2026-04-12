import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function decodeBase64(encoded: string): string {
  return decodeURIComponent(
    atob(encoded)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  )
}

export function extractFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim()
      fm[key] = val
    }
  }
  return fm
}

export function extractScore(content: string): number | null {
  const fm = extractFrontmatter(content)
  if (fm['score']) return parseFloat(fm['score'])
  const match = content.match(/Score[:\s]*(\d+\.?\d*)\/10/i)
  if (match) return parseFloat(match[1])
  const match2 = content.match(/\*\*Score\*\*[:\s]*(\d+\.?\d*)/i)
  if (match2) return parseFloat(match2[1])
  return null
}

export function extractProject(content: string): string {
  const fm = extractFrontmatter(content)
  if (fm['project']) return fm['project']

  // **For project:** News.AI
  const forProjectMatch = content.match(/\*\*For project:\*\*\s*(.+)/i)
  if (forProjectMatch) return forProjectMatch[1].trim()

  // Target Project: ...
  const targetMatch = content.match(/Target Project[:\s]*(.+)/i)
  if (targetMatch) return targetMatch[1].trim()

  // Fallback: detect project names mentioned in the description text
  const knownProjects = ['News.AI', 'Omoikiri.AI', 'Nexus.AI']
  for (const proj of knownProjects) {
    if (content.includes(proj)) return proj
  }

  return 'General'
}

export function extractUrl(content: string): string | null {
  // **URL:** https://...
  const urlFieldMatch = content.match(/\*\*URL:\*\*\s*(https?:\/\/[^\s]+)/i)
  if (urlFieldMatch) return urlFieldMatch[1].trim()

  // # https://github.com/... (title line)
  const titleMatch = content.match(/^#\s+(https?:\/\/[^\s]+)/m)
  if (titleMatch) return titleMatch[1].trim()

  return null
}

const MONTH_NAMES_RU: Record<number, string> = {
  0: 'янв', 1: 'фев', 2: 'мар', 3: 'апр', 4: 'май', 5: 'июн',
  6: 'июл', 7: 'авг', 8: 'сен', 9: 'окт', 10: 'ноя', 11: 'дек',
}

export function formatDateRu(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const day = parseInt(parts[2], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parts[0]
  return `${day} ${MONTH_NAMES_RU[month] || ''} ${year}`
}

export function extractDescription(content: string): string {
  const lines = content.split('\n')
  const bodyStart = content.startsWith('---')
    ? lines.findIndex((l, i) => i > 0 && l === '---') + 1
    : 0
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('**')) {
      return line.length > 160 ? line.slice(0, 157) + '...' : line
    }
  }
  return ''
}

export function extractNiche(content: string): string {
  // **Found by:** vault-research-agent, niche: frontend-ui
  const match = content.match(/niche:\s*([^\n,]+)/i)
  if (match) return match[1].trim()
  return 'unknown'
}

export function extractCategory(content: string): string {
  // **Category:** ui-component
  const fm = extractFrontmatter(content)
  if (fm['category']) return fm['category']
  const match = content.match(/\*\*Category:\*\*\s*([^\n]+)/i)
  if (match) return match[1].trim()
  return 'general'
}

export function getNameFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getDateFromFilename(filename: string): string | null {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/**
 * Parse a run report markdown file into a structured RunReport object.
 * Supports filenames: "2026-04-10_1602.md" and "2026-04-09.md"
 */
export function parseRunReport(filename: string, content: string): import('@/types').RunReport {
  // Extract date and time from filename
  const withTimeMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/)
  const dateOnlyMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})/)

  let date = ''
  let time = ''
  let displayDate = ''

  if (withTimeMatch) {
    const [, year, monthStr, day, hour, min] = withTimeMatch
    const month = parseInt(monthStr, 10) - 1
    date = `${year}-${monthStr}-${day}`
    time = `${hour}:${min}`
    displayDate = `${parseInt(day, 10)} ${MONTH_NAMES_RU[month] || ''} ${year}, ${hour}:${min}`
  } else if (dateOnlyMatch) {
    const [, year, monthStr, day] = dateOnlyMatch
    const month = parseInt(monthStr, 10) - 1
    date = `${year}-${monthStr}-${day}`
    time = ''
    displayDate = `${parseInt(day, 10)} ${MONTH_NAMES_RU[month] || ''} ${year}`
  }

  // Parse Results section
  const totalFoundMatch = content.match(/Total candidates found:\s*(\d+)/i)
  const uniqueMatch = content.match(/Unique after dedup:\s*(\d+)/i)
  const acceptedMatch = content.match(/Accepted[^:]*:\s*(\d+)/i)
  const cardsWrittenMatch = content.match(/Cards written:\s*(\d+)/i)
  const durationMatch = content.match(/\*\*Duration:\*\*\s*(\d+)\s*seconds?/i)

  // Parse Niches searched section
  const nichesSection = content.match(/## Niches searched\n([\s\S]*?)(?:\n##|$)/)
  const niches: import('@/types').NicheInfo[] = []
  if (nichesSection) {
    const lines = nichesSection[1].trim().split('\n')
    for (const line of lines) {
      const nicheMatch = line.match(/^-\s*([^:]+):\s*(.+)$/)
      if (nicheMatch) {
        const name = nicheMatch[1].trim()
        const keywords = nicheMatch[2].split(',').map(k => k.trim()).filter(Boolean)
        niches.push({ name, keywords })
      }
    }
  }

  return {
    filename,
    date,
    time,
    displayDate,
    totalFound: totalFoundMatch ? parseInt(totalFoundMatch[1], 10) : 0,
    uniqueAfterDedup: uniqueMatch ? parseInt(uniqueMatch[1], 10) : 0,
    accepted: acceptedMatch ? parseInt(acceptedMatch[1], 10) : 0,
    cardsWritten: cardsWrittenMatch ? parseInt(cardsWrittenMatch[1], 10) : 0,
    niches,
    durationSeconds: durationMatch ? parseInt(durationMatch[1], 10) : null,
  }
}

/**
 * Determine study status for a candidate card.
 *
 * Priority order:
 * 1. **Status:** field in the card content
 * 2. Cross-reference with existing study folders (folder name contains the repo slug)
 * 3. Default to 'found'
 *
 * Folder naming convention: YYYY-MM-DD-owner-repo
 * Candidate filename: 2026-04-10-measuredco-puck.md → slug = "measuredco-puck"
 */
export function extractStudyStatus(
  content: string,
  candidateFilename: string,
  studyFolders: string[],
): 'found' | 'studied' | 'applied' {
  // 1. Explicit **Status:** field in the card
  const statusMatch = content.match(/\*\*Status:\*\*\s*(\w+)/i)
  if (statusMatch) {
    const s = statusMatch[1].toLowerCase()
    if (s === 'applied') return 'applied'
    if (s === 'studied') return 'studied'
  }

  // 2. Cross-reference with study folders
  // candidateFilename: "2026-04-10-measuredco-puck.md" → slug = "measuredco-puck"
  const slugMatch = candidateFilename.replace(/\.md$/, '').match(/^\d{4}-\d{2}-\d{2}-(.+)$/)
  if (slugMatch) {
    const slug = slugMatch[1].toLowerCase()
    const hasStudy = studyFolders.some(folder =>
      folder.toLowerCase().includes(slug)
    )
    if (hasStudy) return 'studied'
  }

  return 'found'
}

/**
 * Parse overview.md of a study folder to extract deepScore, recommendation, and stack.
 * Returns partial data — missing fields will be null / empty array.
 */
export function parseStudyOverview(
  content: string,
): { deepScore: number | null; recommendation: 'adopt' | 'watch' | 'skip' | null; stack: string[] } {
  // Deep score: **Score:** 8.5/10 or **Deep Score:** 8.5
  const scoreMatch =
    content.match(/\*\*Deep Score:\*\*\s*(\d+\.?\d*)\/10/i) ||
    content.match(/\*\*Deep Score:\*\*\s*(\d+\.?\d*)/i) ||
    content.match(/Score[:\s]*(\d+\.?\d*)\/10/i)
  const deepScore = scoreMatch ? parseFloat(scoreMatch[1]) : null

  // Recommendation: **Recommendation:** adopt / watch / skip
  const recMatch = content.match(/\*\*Recommendation:\*\*\s*(adopt|watch|skip)/i)
  let recommendation: 'adopt' | 'watch' | 'skip' | null = null
  if (recMatch) {
    recommendation = recMatch[1].toLowerCase() as 'adopt' | 'watch' | 'skip'
  }

  // Stack: **Stack:** React, TypeScript, Tailwind  OR  - React\n- TypeScript
  const stackFieldMatch = content.match(/\*\*Stack:\*\*\s*([^\n]+)/i)
  let stack: string[] = []
  if (stackFieldMatch) {
    stack = stackFieldMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean)
  } else {
    // Fallback: look for a Stack section with bullet list
    const stackSection = content.match(/##\s*Stack[\s\S]*?\n((?:\s*[-*]\s*.+\n?)+)/i)
    if (stackSection) {
      stack = stackSection[1]
        .split('\n')
        .map(l => l.replace(/^\s*[-*]\s*/, '').trim())
        .filter(Boolean)
    }
  }

  return { deepScore, recommendation, stack }
}

/**
 * Parse a run filename like "2026-04-09_2230.md" and format it as
 * "9 апр 2026, 22:30"
 */
export function formatRunDateTime(filename: string): string | null {
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/)
  if (!match) return null
  const [, yearStr, monthStr, dayStr, hourStr, minStr] = match
  const day = parseInt(dayStr, 10)
  const month = parseInt(monthStr, 10) - 1
  return `${day} ${MONTH_NAMES_RU[month] || ''} ${yearStr}, ${hourStr}:${minStr}`
}
