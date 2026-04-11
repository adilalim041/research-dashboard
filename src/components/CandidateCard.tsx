import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import type { CandidateCard as CandidateType } from '@/types'
import { cn, formatDateRu } from '@/lib/utils'

interface Props {
  candidate: CandidateType
}

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

export function CandidateCardComponent({ candidate }: Props) {
  const navigate = useNavigate()

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
        <ScoreBadge score={candidate.score} />
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
          <span className="bg-muted px-2 py-0.5 rounded">
            {candidate.project}
          </span>
          {candidate.niche && candidate.niche !== 'unknown' && (
            <span className="bg-accent/10 text-accent px-2 py-0.5 rounded">
              {candidate.niche}
            </span>
          )}
          {candidate.date && (
            <span>{formatDateRu(candidate.date)}</span>
          )}
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
