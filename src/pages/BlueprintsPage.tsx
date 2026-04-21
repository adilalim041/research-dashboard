import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Layers } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useBlueprints } from '@/hooks/useGitHub'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { cn } from '@/lib/utils'
import type { BlueprintCard } from '@/types'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BlueprintCard['status'] }) {
  if (!status) return null
  const styles: Record<NonNullable<BlueprintCard['status']>, string> = {
    draft:    'bg-muted text-muted-foreground',
    active:   'bg-blue-500/15 text-blue-400 border border-blue-500/20',
    shipped:  'bg-green-500/15 text-green-400 border border-green-500/20',
  }
  const labels: Record<NonNullable<BlueprintCard['status']>, string> = {
    draft: 'Черновик',
    active: 'В работе',
    shipped: 'Выпущен',
  }
  return (
    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', styles[status])}>
      {labels[status]}
    </span>
  )
}

// ─── Card component ───────────────────────────────────────────────────────────

function BlueprintCardTile({
  blueprint,
  onClick,
}: {
  blueprint: BlueprintCard
  onClick: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="bg-card border border-border rounded-xl p-5 hover:border-accent/40 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-sm group-hover:text-accent transition-colors line-clamp-2">
          {blueprint.title}
        </h3>
        <StatusBadge status={blueprint.status} />
      </div>

      {blueprint.description ? (
        <p className="text-xs text-muted-foreground line-clamp-3 mb-3 leading-relaxed">
          {blueprint.description}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/50 italic mb-3">Описание отсутствует</p>
      )}

      {blueprint.createdAt && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar size={12} />
          {blueprint.createdAt}
        </div>
      )}
    </div>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function BlueprintDetail({
  blueprint,
  onBack,
}: {
  blueprint: BlueprintCard
  onBack: () => void
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Назад к блюпринтам
      </button>

      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-xl font-bold">{blueprint.title}</h1>
          <StatusBadge status={blueprint.status} />
        </div>
        {blueprint.createdAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar size={12} />
            {blueprint.createdAt}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 lg:p-8">
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {blueprint.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function BlueprintsPage() {
  const { blueprints, loading, error, reload } = useBlueprints()
  const [selected, setSelected] = useState<BlueprintCard | null>(null)
  const navigate = useNavigate()

  if (loading) return <LoadingSpinner message="Загрузка блюпринтов..." />
  if (error)   return <ErrorMessage message={error} onRetry={reload} />

  if (selected) {
    return <BlueprintDetail blueprint={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Блюпринты</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {blueprints.length} продуктовых идей в хранилище
        </p>
      </div>

      {blueprints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
            <Layers size={32} className="text-accent" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Нет блюпринтов</h2>
          <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
            Блюпринты хранятся в <code className="text-xs bg-muted px-1 py-0.5 rounded">research/blueprints/</code> в vault.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blueprints.map((bp) => (
            <BlueprintCardTile
              key={bp.filename}
              blueprint={bp}
              onClick={() => setSelected(bp)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
