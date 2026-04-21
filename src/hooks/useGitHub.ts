import { useState, useEffect, useCallback } from 'react'
import type { CandidateCard, LibraryItem, SubagentInfo, RunReport, StudyReport, BlueprintCard, QueueCommand, QueueStatus, AgentRunEntry } from '@/types'
import {
  getCandidateFiles,
  getFileContent,
  getLibraryCategories,
  getLibraryCategoryFiles,
  getSubagentList,
  getSubagentFiles,
  getRunFiles,
  getStudyFolders,
  getStudyFiles,
  getBlueprintFiles,
  getQueueItems,
  getQueueResult,
  getTelemetryLog,
  getIncidentFiles,
} from '@/services/github'
import {
  extractScore,
  extractProject,
  extractDescription,
  extractUrl,
  extractNiche,
  extractCategory,
  extractUsageType,
  extractTags,
  extractStudyStatus,
  parseStudyOverview,
  getNameFromFilename,
  getDateFromFilename,
  formatRunDateTime,
  parseRunReport,
  extractFrontmatter,
} from '@/lib/utils'

/** Titles matching these patterns are internal notes, not tool candidates */
const INTERNAL_NOTE_PATTERNS = [
  /architecture\s+decision/i,
  /parser\s+options/i,
  /deep\s+analysis/i,
  /websearch\s+research/i,
]

function isInternalNote(name: string): boolean {
  return INTERNAL_NOTE_PATTERNS.some(pattern => pattern.test(name))
}

export function useCandidates() {
  const [candidates, setCandidates] = useState<CandidateCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Load candidate files and study folders in parallel
      const [files, studyDirs] = await Promise.all([
        getCandidateFiles(),
        getStudyFolders().catch(() => []), // graceful: studies folder may not exist yet
      ])

      // Extract folder names for cross-referencing (dirs only, skip _index.md etc.)
      const studyFolderNames = studyDirs
        .filter(d => d.type === 'dir')
        .map(d => d.name)

      const mdFiles = files.filter(f => f.name.endsWith('.md') && f.name !== '_index.md')

      const items = await Promise.all(
        mdFiles.map(async (f) => {
          try {
            const name = getNameFromFilename(f.name)
            if (isInternalNote(name)) return null

            const content = await getFileContent(f.path)
            return {
              name,
              filename: f.name,
              path: f.path,
              score: extractScore(content),
              project: extractProject(content),
              description: extractDescription(content),
              date: getDateFromFilename(f.name),
              url: extractUrl(content),
              niche: extractNiche(content),
              category: extractCategory(content),
              usageType: extractUsageType(content),
              tags: extractTags(content),
              studyStatus: extractStudyStatus(content, f.name, studyFolderNames),
              content,
            }
          } catch {
            return null
          }
        })
      )

      setCandidates(items.filter(Boolean) as CandidateCard[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load candidates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { candidates, loading, error, reload: load }
}

export function useLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const dirs = await getLibraryCategories()
      const catDirs = dirs.filter(d => d.type === 'dir')
      setCategories(catDirs.map(d => d.name))

      const allItems: LibraryItem[] = []
      for (const dir of catDirs) {
        try {
          const files = await getLibraryCategoryFiles(dir.name)
          for (const file of files) {
            try {
              const content = await getFileContent(file.path)
              allItems.push({
                name: getNameFromFilename(file.name),
                filename: file.name,
                path: file.path,
                category: dir.name,
                content,
              })
            } catch { /* skip files we can't read */ }
          }
        } catch { /* skip categories we can't read */ }
      }
      setItems(allItems)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load library')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { items, categories, loading, error, reload: load }
}

export function useSubagents() {
  const [agents, setAgents] = useState<SubagentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const dirs = await getSubagentList()
      const agentDirs = dirs.filter(d => d.type === 'dir')

      const agentInfos = await Promise.all(
        agentDirs.map(async (d) => {
          try {
            const files = await getSubagentFiles(d.name)
            let role = ''
            const roleFile = files.find(f => f.name === 'role.md')
            if (roleFile) {
              try {
                const content = await getFileContent(roleFile.path)
                const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#'))
                role = firstLine?.trim() || ''
              } catch { /* */ }
            }

            let learningsCount = 0
            const recentLearnings: string[] = []
            const learningsFile = files.find(f => f.name === 'learnings.md')
            if (learningsFile) {
              try {
                const content = await getFileContent(learningsFile.path)
                const lines = content.split('\n').filter(l => l.startsWith('- '))
                learningsCount = lines.length
                recentLearnings.push(...lines.slice(-5).reverse().map(l => l.replace(/^- /, '')))
              } catch { /* */ }
            }

            return {
              name: d.name,
              displayName: d.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              role,
              learningsCount,
              recentLearnings,
            }
          } catch {
            return {
              name: d.name,
              displayName: d.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              role: '',
              learningsCount: 0,
              recentLearnings: [],
            }
          }
        })
      )

      setAgents(agentInfos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subagents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { agents, loading, error, reload: load }
}

export function useLastRunTime() {
  const [formatted, setFormatted] = useState<string>('N/A')
  const [timeAgo, setTimeAgo] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const files = await getRunFiles()
      const mdFiles = files
        .filter(f => f.name.endsWith('.md'))
        .sort((a, b) => b.name.localeCompare(a.name))

      if (mdFiles.length > 0) {
        const parsed = formatRunDateTime(mdFiles[0].name)
        if (parsed) {
          setFormatted(parsed)
        }
        // Calculate "X ago" from filename (Astana UTC+5 timestamps)
        const match = mdFiles[0].name.match(/^(\d{4})-(\d{2})-(\d{2})_?(\d{2})?(\d{2})?/)
        if (match) {
          const [, y, mo, d, h, m] = match
          // Parse as Astana time (UTC+5), convert to UTC for comparison
          const runDate = new Date(`${y}-${mo}-${d}T${h || '00'}:${m || '00'}:00+05:00`)
          const now = new Date()
          const diffMs = now.getTime() - runDate.getTime()
          const diffH = Math.floor(diffMs / 3600000)
          if (diffH < 1) setTimeAgo('менее часа назад')
          else if (diffH < 24) setTimeAgo(`${diffH}ч назад`)
          else setTimeAgo(`${Math.floor(diffH / 24)}д назад`)
        }
      }
    } catch {
      // silently fail — card will show N/A
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { formatted, timeAgo, loading }
}

export function useRunReports() {
  const [reports, setReports] = useState<RunReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const files = await getRunFiles()
      const mdFiles = files
        .filter(f => f.name.endsWith('.md'))
        .sort((a, b) => b.name.localeCompare(a.name))

      const parsed = await Promise.all(
        mdFiles.map(async (f) => {
          try {
            const content = await getFileContent(f.path)
            return parseRunReport(f.name, content)
          } catch {
            return null
          }
        })
      )

      setReports(parsed.filter(Boolean) as RunReport[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { reports, loading, error, reload: load }
}

export function useStudies() {
  const [studies, setStudies] = useState<StudyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const dirs = await getStudyFolders().catch(() => [])
      const studyDirs = dirs.filter(d => d.type === 'dir')

      if (studyDirs.length === 0) {
        setStudies([])
        return
      }

      const reports = await Promise.all(
        studyDirs.map(async (d): Promise<StudyReport> => {
          // Folder name format: YYYY-MM-DD-owner-repo
          const dateMatch = d.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/)
          const date = dateMatch ? dateMatch[1] : null
          const repoName = dateMatch
            ? dateMatch[2].replace(/-/g, '/').replace(/\//, '-') // owner-repo → keep as-is
            : d.name

          let deepScore: number | null = null
          let recommendation: 'adopt' | 'watch' | 'skip' | null = null
          let stack: string[] = []
          let files: string[] = []
          let candidateFilename: string | null = null

          try {
            const studyFiles = await getStudyFiles(d.name)
            const mdFiles = studyFiles.filter(f => f.name.endsWith('.md'))
            files = mdFiles.map(f => f.name.replace(/\.md$/, ''))

            // Parse overview.md if it exists
            const overviewFile = mdFiles.find(f => f.name === 'overview.md')
            if (overviewFile) {
              try {
                const content = await getFileContent(overviewFile.path)
                const parsed = parseStudyOverview(content)
                deepScore = parsed.deepScore
                recommendation = parsed.recommendation
                stack = parsed.stack

                // Extract candidate filename reference if present
                // e.g. **Candidate:** 2026-04-10-measuredco-puck.md
                const candMatch = content.match(/\*\*Candidate:\*\*\s*([^\s\n]+\.md)/i)
                if (candMatch) candidateFilename = candMatch[1]
              } catch { /* overview unreadable, skip */ }
            }

            // If candidate filename not in overview, try to infer from folder name
            // Folder: 2026-04-10-measuredco-puck → candidate: 2026-04-10-measuredco-puck.md
            if (!candidateFilename && dateMatch) {
              candidateFilename = `${d.name}.md`
            }
          } catch { /* study files unreadable */ }

          return {
            repoName,
            folderName: d.name,
            date,
            deepScore,
            recommendation,
            stack,
            files,
            candidateFilename,
          }
        })
      )

      // Sort by date descending (most recent first)
      reports.sort((a, b) => {
        if (!a.date && !b.date) return 0
        if (!a.date) return 1
        if (!b.date) return -1
        return b.date.localeCompare(a.date)
      })

      setStudies(reports)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load studies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { studies, loading, error, reload: load }
}

// ─── Blueprints hook ──────────────────────────────────────────────────────────

function extractBlueprintDescription(content: string): string {
  // Strip frontmatter
  const withoutFm = content.startsWith('---')
    ? content.replace(/^---[\s\S]*?---\n?/, '')
    : content

  const lines = withoutFm.split('\n')

  // Look for Problem / Overview section first
  const problemIdx = lines.findIndex(l => /^##\s*(problem|overview)/i.test(l))
  if (problemIdx !== -1) {
    for (let i = problemIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line && !line.startsWith('#')) {
        return line.length > 200 ? line.slice(0, 197) + '...' : line
      }
    }
  }

  // Fallback: first non-empty, non-heading paragraph
  for (const line of lines) {
    const t = line.trim()
    if (t && !t.startsWith('#') && !t.startsWith('---') && !t.startsWith('**')) {
      return t.length > 200 ? t.slice(0, 197) + '...' : t
    }
  }

  return ''
}

export function useBlueprints() {
  const [blueprints, setBlueprints] = useState<BlueprintCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const files = await getBlueprintFiles()

      const items = await Promise.all(
        files.map(async (f) => {
          try {
            const content = await getFileContent(f.path)
            const fm = extractFrontmatter(content)

            // Title: first H1 or filename-derived
            const h1Match = content.match(/^#\s+(.+)/m)
            const title = h1Match ? h1Match[1].trim() : getNameFromFilename(f.name)

            const rawStatus = fm['status']?.toLowerCase()
            const status: BlueprintCard['status'] =
              rawStatus === 'active' ? 'active' :
              rawStatus === 'shipped' ? 'shipped' :
              rawStatus === 'draft' ? 'draft' : null

            const createdAt = fm['created_at'] || getDateFromFilename(f.name)

            return {
              filename: f.name,
              path: f.path,
              title,
              status,
              createdAt,
              description: extractBlueprintDescription(content),
              content,
            } satisfies BlueprintCard
          } catch {
            return null
          }
        })
      )

      setBlueprints(items.filter(Boolean) as BlueprintCard[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load blueprints')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { blueprints, loading, error, reload: load }
}

// ─── Queue hook ───────────────────────────────────────────────────────────────

const QUEUE_STATUSES: QueueStatus[] = ['pending', 'processing', 'done', 'failed']

function parseCommandType(raw: string | undefined): QueueCommand['type'] {
  if (!raw) return 'research'
  const t = raw.toLowerCase()
  if (t === 'blueprint') return 'blueprint'
  if (t === 'study') return 'study'
  if (t === 'match') return 'match'
  return 'research'
}

export function useQueue() {
  const [columns, setColumns] = useState<Record<QueueStatus, QueueCommand[]>>({
    pending: [], processing: [], done: [], failed: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [pendingFiles, processingFiles, doneFiles, failedFiles] = await Promise.all(
        QUEUE_STATUSES.map(s => getQueueItems(s))
      )

      const filesByStatus: Record<QueueStatus, typeof pendingFiles> = {
        pending: pendingFiles,
        processing: processingFiles,
        done: doneFiles,
        failed: failedFiles,
      }

      const result: Record<QueueStatus, QueueCommand[]> = {
        pending: [], processing: [], done: [], failed: [],
      }

      for (const status of QUEUE_STATUSES) {
        const files = filesByStatus[status]
        const commands = await Promise.all(
          files.map(async (f) => {
            try {
              const raw = await getFileContent(f.path)
              const parsed = JSON.parse(raw)

              // For done/failed: try to load result/error sidecar
              let summary: string | undefined
              let artifactCount: number | undefined
              let errorMessage: string | undefined

              const baseName = f.name.replace(/\.json$/, '')

              if (status === 'done') {
                const resultRaw = await getQueueResult('done', baseName)
                if (resultRaw) {
                  try {
                    const result = JSON.parse(resultRaw)
                    summary = result.summary ?? undefined
                    artifactCount = result.artifacts?.length ?? result.artifact_count ?? undefined
                  } catch { /* ignore */ }
                }
              } else if (status === 'failed') {
                const errorRaw = await getQueueResult('failed', baseName)
                if (errorRaw) {
                  try {
                    const errObj = JSON.parse(errorRaw)
                    errorMessage = errObj.error_message ?? errObj.message ?? undefined
                  } catch { /* ignore */ }
                }
              }

              return {
                id: parsed.id ?? f.name.replace(/\.json$/, ''),
                type: parseCommandType(parsed.type),
                status,
                created_by: parsed.created_by ?? 'unknown',
                created_at: parsed.created_at ?? '',
                payload: parsed.payload ?? {},
                completed_at: parsed.completed_at,
                summary,
                artifact_count: artifactCount,
                error_message: errorMessage,
                raw,
              } satisfies QueueCommand
            } catch {
              return null
            }
          })
        )
        result[status] = commands.filter(Boolean) as QueueCommand[]
      }

      // Sort done by completed_at desc, limit 20 by default
      result.done.sort((a, b) => {
        const da = a.completed_at || a.created_at
        const db = b.completed_at || b.created_at
        return db.localeCompare(da)
      })

      setColumns(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { columns, loading, error, reload: load }
}

// ─── Telemetry hook ───────────────────────────────────────────────────────────

export function useTelemetry() {
  const [entries, setEntries] = useState<AgentRunEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const raw = await getTelemetryLog()
      const parsed = raw
        .split('\n')
        .filter(Boolean)
        .map(line => {
          try { return JSON.parse(line) as AgentRunEntry }
          catch { return null }
        })
        .filter(Boolean) as AgentRunEntry[]

      setEntries(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load telemetry')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { entries, loading, error, reload: load }
}

// ─── Incidents hook (for CandidateDetailPage sidebar) ────────────────────────

export interface IncidentMeta {
  filename: string
  path: string
  title: string
  date: string | null
  preview: string
  content: string
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<IncidentMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const files = await getIncidentFiles()

      const items = await Promise.all(
        files.map(async (f) => {
          try {
            const content = await getFileContent(f.path)
            const h1Match = content.match(/^#\s+(.+)/m)
            const title = h1Match ? h1Match[1].trim() : getNameFromFilename(f.name)
            const dateMatch = f.name.match(/^(\d{4}-\d{2}-\d{2})/)
            const date = dateMatch ? dateMatch[1] : null

            // First two non-empty, non-heading lines as preview
            const previewLines = content
              .split('\n')
              .filter(l => l.trim() && !l.startsWith('#'))
              .slice(0, 2)
              .join(' ')

            return { filename: f.name, path: f.path, title, date, preview: previewLines, content }
          } catch {
            return null
          }
        })
      )

      setIncidents(items.filter(Boolean) as IncidentMeta[])
    } catch {
      setError('Failed to load incidents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { incidents, loading, error }
}
