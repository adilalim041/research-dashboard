import { useState, useEffect, useCallback } from 'react'
import type { CandidateCard, LibraryItem, SubagentInfo, RunReport } from '@/types'
import {
  getCandidateFiles,
  getFileContent,
  getLibraryCategories,
  getLibraryCategoryFiles,
  getSubagentList,
  getSubagentFiles,
  getRunFiles,
} from '@/services/github'
import {
  extractScore,
  extractProject,
  extractDescription,
  extractUrl,
  extractNiche,
  extractCategory,
  getNameFromFilename,
  getDateFromFilename,
  formatRunDateTime,
  parseRunReport,
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
      const files = await getCandidateFiles()
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
      }
    } catch {
      // silently fail — card will show N/A
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { formatted, loading }
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
