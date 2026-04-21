import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { CandidateCard as CandidateType } from '@/types'
import { cn, formatDateRu } from '@/lib/utils'
import { PromoteModal } from '@/components/PromoteModal'

interface Props {
  candidate: CandidateType
  compact?: boolean
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const color =
    score >= 8 ? 'bg-success/15 text-success' :
    score >= 6 ? 'bg-warning/15 text-warning' :
    'bg-danger/15 text-danger'
  return (
    <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded-full', color)}>
      {score.toFixed(1)}
    </span>
  )
}

/** Badge colors per studyStatus — matches the task spec */
function StatusBadge({ status }: { status: CandidateType['studyStatus'] }) {
  const styles: Record<CandidateType['studyStatus'], string> = {
    found:              'bg-muted text-muted-foreground',
    'promoted-tier-A':  'bg-blue-500/15 text-blue-400 border border-blue-500/20',
    'promoted-tier-B':  'bg-sky-500/15 text-sky-400 border border-sky-500/20',
    studied:            'bg-green-500/15 text-green-400 border border-green-500/20',
    rejected:           'bg-danger/15 text-danger border border-danger/20',
    applied:            'bg-green-500/15 text-green-400 border border-green-500/20',
  }
  const labels: Record<CandidateType['studyStatus'], string> = {
    found:             'найден',
    'promoted-tier-A': 'Tier A',
    'promoted-tier-B': 'Tier B',
    studied:           'изучен',
    rejected:          'отклонён',
    applied:           'применён',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full', styles[status] || 'bg-muted text-muted-foreground')}>
      {labels[status] || status}
    </span>
  )
}

function extractMeta(content: string): {
  stars: string | null
  lang: string | null
  lastCommit: string | null
  whyInteresting: string | null
  whatItDoes: string | null
} {
  const starsMatch = content.match(/\*\*Stars:\*\*\s*([\d,k+]+)/i)
  const langMatch  = content.match(/\*\*(?:Primary )?Language:\*\*\s*([^\n]+)/i) ||
                     content.match(/\*\*Lang(?:uage)?:\*\*\s*([^\n]+)/i)
  const commitMatch = content.match(/\*\*Last commit:\*\*\s*([^\n]+)/i) ||
                      content.match(/\*\*Updated:\*\*\s*([^\n]+)/i)

  // "What it does" — look for section or field
  const whatDoesSection = content.match(/##\s*What it does\n+([\s\S]*?)(?:\n##|$)/i)
  const whatFieldMatch  = content.match(/\*\*What it does:\*\*\s*([^\n]+)/i)
  let whatItDoes: string | null = null
  if (whatDoesSection) {
    const first = whatDoesSection[1].split('\n').find(l => l.trim() && !l.startsWith('#'))
    if (first) whatItDoes = first.trim()
  } else if (whatFieldMatch) {
    whatItDoes = whatFieldMatch[1].trim()
  }

  // "Why interesting"
  const whySection  = content.match(/##\s*Why it['']s interesting\n+([\s\S]*?)(?:\n##|$)/i)
  const whyMatch    = content.match(/\*\*Why it['']?s interesting:\*\*\s*([^\n]+)/i)
  let whyInteresting: string | null = null
  if (whySection) {
    const first = whySection[1].split('\n').find(l => l.trim() && !l.startsWith('#'))
    if (first) whyInteresting = first.trim()
  } else if (whyMatch) {
    whyInteresting = whyMatch[1].trim()
  }

  return {
    stars:        starsMatch  ? starsMatch[1].trim()  : null,
    lang:         langMatch   ? langMatch[1].trim()   : null,
    lastCommit:   commitMatch ? commitMatch[1].trim() : null,
    whyInteresting,
    whatItDoes,
  }
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 1) + '…' : s
}

// ─── Full card ────────────────────────────────────────────────────────────────

function FullCard({ candidate }: { candidate: CandidateType }) {
  const navigate = useNavigate()
  const [promoted, setPromoted] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/candidates/${encodeURIComponent(candidate.filename)}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/candidates/${encodeURIComponent(candidate.filename)}`)}
      className="block bg-card border border-border rounded-xl p-5 hover:border-accent/40 transition-colors group cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-sm group-hover:text-accent transition-colors line-clamp-2">
          {candidate.name}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {!promoted && (
            <PromoteModal
              slug={candidate.filename.replace(/\.md$/, '')}
              autoProject={candidate.project}
              status={candidate.studyStatus}
              onPromoted={() => setPromoted(true)}
            />
          )}
          <StatusBadge status={candidate.studyStatus} />
          <ScoreBadge score={candidate.score} />
        </div>
      </div>

      {candidate.description ? (
        <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
          {candidate.description}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/50 italic line-clamp-3 mb-3">
          Описание отсутствует
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-muted px-2 py-0.5 rounded">{candidate.project}</span>
          {candidate.niche && candidate.niche !== 'unknown' && (
            <span className="bg-accent/10 text-accent px-2 py-0.5 rounded">{candidate.niche}</span>
          )}
          {candidate.date && <span>{formatDateRu(candidate.date)}</span>}
        </div>
        {candidate.url && (
          <a
            href={candidate.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-muted-foreground hover:text-accent transition-colors"
            title="Открыть на GitHub"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Compact card (5-line layout) ─────────────────────────────────────────────

function CompactCard({ candidate }: { candidate: CandidateType }) {
  const navigate = useNavigate()
  const [promoted, setPromoted] = useState(false)
  const meta = extractMeta(candidate.content)

  const oneLiner = meta.whatItDoes
    ? truncate(meta.whatItDoes, 80)
    : candidate.description
    ? truncate(candidate.description, 80)
    : null

  const metaLine = [
    meta.stars ? `${meta.stars} stars` : null,
    meta.lang  ? meta.lang  : null,
    meta.lastCommit ? `last commit ${meta.lastCommit}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/candidates/${encodeURIComponent(candidate.filename)}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/candidates/${encodeURIComponent(candidate.filename)}`)}
      className="bg-card border border-border rounded-xl px-4 py-3.5 hover:border-accent/40 transition-colors group cursor-pointer"
    >
      {/* Line 1: title + one-liner */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium group-hover:text-accent transition-colors line-clamp-1">
          <span className="font-semibold">{candidate.name}</span>
          {oneLiner && (
            <span className="text-muted-foreground font-normal"> — {oneLiner}</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!promoted && (
            <PromoteModal
              slug={candidate.filename.replace(/\.md$/, '')}
              autoProject={candidate.project}
              status={candidate.studyStatus}
              onPromoted={() => setPromoted(true)}
            />
          )}
        </div>
      </div>

      {/* Line 2: meta (stars / lang / last commit) */}
      {metaLine && (
        <p className="text-xs text-muted-foreground mb-1">{metaLine}</p>
      )}

      {/* Line 3: Fit */}
      <p className="text-xs text-muted-foreground mb-1">
        <span className="text-foreground font-medium">Fit:</span>{' '}
        {candidate.project}
        {candidate.category && candidate.category !== 'general' && (
          <span className="text-muted-foreground/70"> ({candidate.category})</span>
        )}
      </p>

      {/* Line 4: Why interesting */}
      {meta.whyInteresting && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
          {truncate(meta.whyInteresting, 120)}
        </p>
      )}

      {/* Line 5: status badge + score */}
      <div className="flex items-center gap-2">
        <StatusBadge status={candidate.studyStatus} />
        {candidate.score !== null && (
          <ScoreBadge score={candidate.score} />
        )}
      </div>
    </div>
  )
}

// ─── Exported component ───────────────────────────────────────────────────────

export function CandidateCardComponent({ candidate, compact = false }: Props) {
  if (compact) return <CompactCard candidate={candidate} />
  return <FullCard candidate={candidate} />
}
