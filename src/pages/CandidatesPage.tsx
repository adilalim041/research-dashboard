import { useState, useMemo } from 'react'
import { Search, ArrowUpDown, X, Layers } from 'lucide-react'
import { useCandidates } from '@/hooks/useGitHub'
import { CandidateCardComponent } from '@/components/CandidateCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { cn } from '@/lib/utils'
import type { CandidateCard } from '@/types'

type SortKey = 'date' | 'score' | 'name'
type StatusFilter = 'all' | 'found' | 'studied' | 'applied'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all:     'Все статусы',
  found:   'Найдено',
  studied: 'Изучено',
  applied: 'Применено',
}

const USAGE_TYPE_LABELS: Record<string, string> = {
  all:            'Все типы',
  library:        'Library',
  tool:           'Tool',
  'product-idea': 'Product idea',
  pattern:        'Pattern',
  reference:      'Reference',
}

// Known ordered usage types for group-by sections
const USAGE_TYPE_ORDER = ['library', 'tool', 'product-idea', 'pattern', 'reference']

export function CandidatesPage() {
  const { candidates, loading, error, reload } = useCandidates()

  // ─── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [usageTypeFilter, setUsageTypeFilter] = useState<string>('all')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [groupByType, setGroupByType] = useState(false)

  // ─── Derived: project list ─────────────────────────────────────────────────
  const projects = useMemo(() => {
    const set = new Set(candidates.map(c => c.project))
    return ['all', ...Array.from(set).sort()]
  }, [candidates])

  // ─── Derived: all unique tags across all cards ─────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>()
    candidates.forEach(c => c.tags.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [candidates])

  // ─── Tag toggle ───────────────────────────────────────────────────────────
  function toggleTag(tag: string) {
    setActiveTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  // ─── Clear all filters ────────────────────────────────────────────────────
  function clearFilters() {
    setSearch('')
    setProjectFilter('all')
    setStatusFilter('all')
    setUsageTypeFilter('all')
    setActiveTags(new Set())
  }

  const hasActiveFilters =
    search !== '' ||
    projectFilter !== 'all' ||
    statusFilter !== 'all' ||
    usageTypeFilter !== 'all' ||
    activeTags.size > 0

  // ─── Filtered + sorted candidates ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let result: CandidateCard[] = [...candidates]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      )
    }

    if (projectFilter !== 'all') {
      result = result.filter(c => c.project === projectFilter)
    }

    if (statusFilter !== 'all') {
      result = result.filter(c => c.studyStatus === statusFilter)
    }

    if (usageTypeFilter !== 'all') {
      result = result.filter(c => c.usageType === usageTypeFilter)
    }

    // Tag filter: OR logic — show card if it has at least one active tag
    if (activeTags.size > 0) {
      result = result.filter(c => c.tags.some(t => activeTags.has(t)))
    }

    result.sort((a, b) => {
      if (sortBy === 'date') return (b.date || '').localeCompare(a.date || '')
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0)
      return a.name.localeCompare(b.name)
    })

    return result
  }, [candidates, search, projectFilter, statusFilter, usageTypeFilter, activeTags, sortBy])

  // ─── Group-by-type map ────────────────────────────────────────────────────
  const groupedByType = useMemo(() => {
    if (!groupByType) return null
    const map = new Map<string, CandidateCard[]>()
    for (const c of filtered) {
      const key = c.usageType || 'untyped'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    // Sort groups: known types first in order, then 'untyped' last
    const sorted = new Map<string, CandidateCard[]>()
    for (const t of USAGE_TYPE_ORDER) {
      if (map.has(t)) sorted.set(t, map.get(t)!)
    }
    if (map.has('untyped')) sorted.set('untyped', map.get('untyped')!)
    // Catch any unknown types not in order list
    for (const [k, v] of map) {
      if (!sorted.has(k)) sorted.set(k, v)
    }
    return sorted
  }, [filtered, groupByType])

  const sortLabels: Record<SortKey, string> = {
    date:  'дата',
    score: 'оценка',
    name:  'имя',
  }

  if (loading) return <LoadingSpinner message="Загрузка кандидатов..." />
  if (error)   return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Кандидаты</h1>
        <p className="text-muted-foreground text-sm mt-1">
          <span className="font-medium text-foreground">{filtered.length}</span>
          {' '}из{' '}
          <span>{candidates.length}</span>
          {' '}инструментов и библиотек
        </p>
      </div>

      {/* ─── Filter row 1: search + dropdowns + sort + group toggle ────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск по названию или описанию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent"
          />
        </div>

        {/* Usage type dropdown */}
        <select
          value={usageTypeFilter}
          onChange={(e) => setUsageTypeFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        >
          {Object.entries(USAGE_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        {/* Project dropdown */}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        >
          {projects.map(p => (
            <option key={p} value={p}>
              {p === 'all' ? 'Все проекты' : p}
            </option>
          ))}
        </select>

        {/* Status dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        >
          {(Object.entries(STATUS_LABELS) as [StatusFilter, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        {/* Sort cycle button */}
        <button
          onClick={() => setSortBy(s => s === 'date' ? 'score' : s === 'score' ? 'name' : 'date')}
          className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5 text-sm hover:bg-muted transition-colors whitespace-nowrap"
        >
          <ArrowUpDown size={14} />
          {sortLabels[sortBy]}
        </button>

        {/* Group by type toggle */}
        <button
          onClick={() => setGroupByType(g => !g)}
          title="Группировать по типу"
          className={cn(
            'flex items-center gap-2 border rounded-lg px-4 py-2.5 text-sm transition-colors whitespace-nowrap',
            groupByType
              ? 'bg-accent text-accent-foreground border-accent'
              : 'bg-card border-border hover:bg-muted'
          )}
        >
          <Layers size={14} />
          Группы
        </button>
      </div>

      {/* ─── Tag chips ──────────────────────────────────────────────────── */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                activeTags.has(tag)
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-card text-muted-foreground border-border hover:border-accent/60 hover:text-foreground'
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* ─── Active filter indicator + clear button ──────────────────── */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Активны фильтры</span>
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <X size={12} />
            Сбросить все
          </button>
        </div>
      )}

      {/* ─── Empty state ─────────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-3">Нет кандидатов под эти фильтры.</p>
          <button
            onClick={clearFilters}
            className="text-sm text-accent hover:underline"
          >
            Сбросить фильтры
          </button>
        </div>
      )}

      {/* ─── Cards: grouped or flat ──────────────────────────────────── */}
      {filtered.length > 0 && groupedByType && groupedByType.size > 0 ? (
        <div className="space-y-8">
          {Array.from(groupedByType.entries()).map(([type, cards]) => (
            <section key={type}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {USAGE_TYPE_LABELS[type] || type}
                <span className="ml-2 text-xs font-normal normal-case">({cards.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map(c => (
                  <CandidateCardComponent key={c.filename} candidate={c} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CandidateCardComponent key={c.filename} candidate={c} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
