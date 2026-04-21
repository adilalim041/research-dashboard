import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { X, Clock, Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { useQueue } from '@/hooks/useGitHub'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { cn } from '@/lib/utils'
import type { QueueCommand, QueueStatus, CommandType } from '@/types'

// ─── Type badge ───────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<CommandType, string> = {
  blueprint: 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
  study:     'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  match:     'bg-orange-500/15 text-orange-400 border border-orange-500/20',
  research:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
}

function TypeBadge({ type }: { type: CommandType }) {
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded capitalize', TYPE_STYLES[type])}>
      {type}
    </span>
  )
}

// ─── Time formatting ──────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  if (!isoString) return ''
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true, locale: ru })
  } catch {
    return isoString
  }
}

// ─── Command card ─────────────────────────────────────────────────────────────

function getCardDescription(cmd: QueueCommand): string {
  const p = cmd.payload
  if (cmd.type === 'blueprint' && p.idea) return String(p.idea)
  if (cmd.type === 'study' && p.owner_repo) return String(p.owner_repo)
  if (cmd.type === 'match' && p.query) return String(p.query)
  if (p.description) return String(p.description)
  return ''
}

function CommandCard({
  cmd,
  onOpen,
}: {
  cmd: QueueCommand
  onOpen: (cmd: QueueCommand) => void
}) {
  const shortId = cmd.id.length > 40 ? '…' + cmd.id.slice(-40) : cmd.id
  const desc = getCardDescription(cmd)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(cmd)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(cmd)}
      className="bg-card border border-border rounded-lg p-3.5 hover:border-accent/40 transition-colors cursor-pointer group"
    >
      {/* ID */}
      <p className="text-xs font-mono text-muted-foreground truncate mb-2">{shortId}</p>

      {/* Type + created_by */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <TypeBadge type={cmd.type} />
        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{cmd.created_by}</span>
      </div>

      {/* Description */}
      {desc && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">{desc}</p>
      )}

      {/* Done: summary + artifacts */}
      {cmd.status === 'done' && (cmd.summary || cmd.artifact_count !== undefined) && (
        <div className="border-t border-border pt-2 mt-2">
          {cmd.summary && (
            <p className="text-xs text-foreground line-clamp-2 mb-1">{cmd.summary}</p>
          )}
          {cmd.artifact_count !== undefined && (
            <p className="text-xs text-muted-foreground">{cmd.artifact_count} артефактов</p>
          )}
        </div>
      )}

      {/* Failed: error */}
      {cmd.status === 'failed' && cmd.error_message && (
        <div className="border-t border-border pt-2 mt-2">
          <p className="text-xs text-danger line-clamp-2">{cmd.error_message}</p>
        </div>
      )}

      {/* Time */}
      <div className="flex items-center gap-1 mt-2">
        <Clock size={11} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {timeAgo(cmd.completed_at || cmd.created_at)}
        </span>
      </div>
    </div>
  )
}

// ─── Column header ────────────────────────────────────────────────────────────

const COLUMN_CONFIG: Record<QueueStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending:    { label: 'Ожидание',   icon: <Clock size={14} />,         color: 'text-muted-foreground' },
  processing: { label: 'В процессе', icon: <Loader2 size={14} />,       color: 'text-blue-400' },
  done:       { label: 'Готово',     icon: <CheckCircle2 size={14} />,   color: 'text-green-400' },
  failed:     { label: 'Ошибка',     icon: <XCircle size={14} />,        color: 'text-danger' },
}

function ColumnHeader({ status, count }: { status: QueueStatus; count: number }) {
  const cfg = COLUMN_CONFIG[status]
  return (
    <div className={cn('flex items-center gap-2 mb-3 font-semibold text-sm', cfg.color)}>
      {cfg.icon}
      {cfg.label}
      <span className="ml-auto bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-normal">
        {count}
      </span>
    </div>
  )
}

// ─── JSON modal ───────────────────────────────────────────────────────────────

function RawJsonModal({
  cmd,
  open,
  onClose,
}: {
  cmd: QueueCommand | null
  open: boolean
  onClose: () => void
}) {
  if (!cmd) return null

  let pretty = cmd.raw
  try { pretty = JSON.stringify(JSON.parse(cmd.raw), null, 2) } catch { /* keep raw */ }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-2xl max-h-[80vh] flex flex-col',
            'bg-card border border-border rounded-xl shadow-xl',
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <Dialog.Title className="text-sm font-semibold">
              Raw JSON — {cmd.id.slice(-20)}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="overflow-auto p-5 flex-1">
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all">
              {pretty}
            </pre>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const STATUSES: QueueStatus[] = ['pending', 'processing', 'done', 'failed']
const DONE_DEFAULT_LIMIT = 20

export function QueuePage() {
  const { columns, loading, error, reload } = useQueue()
  const [selectedCmd, setSelectedCmd] = useState<QueueCommand | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [showAllDone, setShowAllDone] = useState(false)

  if (loading) return <LoadingSpinner message="Загрузка очереди..." />
  if (error)   return <ErrorMessage message={error} onRetry={reload} />

  const handleOpen = (cmd: QueueCommand) => {
    setSelectedCmd(cmd)
    setModalOpen(true)
  }

  const doneAll = columns.done
  const doneVisible = showAllDone ? doneAll : doneAll.slice(0, DONE_DEFAULT_LIMIT)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Очередь команд</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {STATUSES.reduce((s, k) => s + columns[k].length, 0)} команд всего
        </p>
      </div>

      {/* Kanban grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map((status) => {
          const items = status === 'done' ? doneVisible : columns[status]
          const total = columns[status].length

          return (
            <div key={status} className="flex flex-col">
              <ColumnHeader status={status} count={total} />

              {items.length === 0 ? (
                <div className="bg-card border border-border border-dashed rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Пусто</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((cmd) => (
                    <CommandCard key={cmd.id} cmd={cmd} onOpen={handleOpen} />
                  ))}
                </div>
              )}

              {/* Done: show-all toggle */}
              {status === 'done' && total > DONE_DEFAULT_LIMIT && (
                <button
                  onClick={() => setShowAllDone(!showAllDone)}
                  className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 border border-border rounded-lg hover:bg-muted"
                >
                  <ChevronDown
                    size={14}
                    className={cn('transition-transform', showAllDone && 'rotate-180')}
                  />
                  {showAllDone ? 'Скрыть' : `Показать все (${total})`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <RawJsonModal
        cmd={selectedCmd}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
