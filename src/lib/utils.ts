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
