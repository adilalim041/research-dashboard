import { useState, useMemo } from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import { useCandidates } from '@/hooks/useGitHub'
import { CandidateCardComponent } from '@/components/CandidateCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import type { CandidateCard } from '@/types'

type SortKey = 'date' | 'score' | 'name'
type StatusFilter = 'all' | 'found' | 'studied' | 'applied'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all:     'Все статусы',
  found:   'Найдено',
  studied: 'Изучено',
  applied: 'Применено',
}

export function CandidatesPage() {
  const { candidates, loading, error, reload } = useCandidates()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('date')

  const projects = useMemo(() => {
    const set = new Set(candidates.map(c => c.project))
    return ['all', ...Array.from(set).sort()]
  }, [candidates])

  const filtered = useMemo(() => {
    let result: CandidateCard[] = [...candidates]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
      )
    }

    if (projectFilter !== 'all') {
      result = result.filter(c => c.project === projectFilter)
    }

    if (statusFilter !== 'all') {
      result = result.filter(c => c.studyStatus === statusFilter)
    }

    result.sort((a, b) => {
      if (sortBy === 'date') {
        return (b.date || '').localeCompare(a.date || '')
      }
      if (sortBy === 'score') {
        return (b.score || 0) - (a.score || 0)
      }
      return a.name.localeCompare(b.name)
    })

    return result
  }, [candidates, search, projectFilter, statusFilter, sortBy])

  const sortLabels: Record<SortKey, string> = {
    date:  'дата',
    score: 'оценка',
    name:  'имя',
  }

  if (loading) return <LoadingSpinner message="Загрузка кандидатов..." />
  if (error)   return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Кандидаты</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {candidates.length} инструментов и библиотек оценено агентом
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск кандидатов..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent"
          />
        </div>

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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        >
          {(Object.entries(STATUS_LABELS) as [StatusFilter, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        <button
          onClick={() => setSortBy(s => s === 'date' ? 'score' : s === 'score' ? 'name' : 'date')}
          className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5 text-sm hover:bg-muted transition-colors"
        >
          <ArrowUpDown size={14} />
          Сортировка: {sortLabels[sortBy]}
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <CandidateCardComponent key={c.filename} candidate={c} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          Ничего не найдено по вашим фильтрам.
        </p>
      )}
    </div>
  )
}
