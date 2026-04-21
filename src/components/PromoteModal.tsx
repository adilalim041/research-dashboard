/**
 * PromoteModal — dialog for queuing a candidate for deeper study.
 * Appears on CandidateCard (full + compact) and CandidateDetailPage.
 * Shows only for candidates with status 'found' or null.
 */
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as RadioGroup from '@radix-ui/react-radio-group'
import * as Select from '@radix-ui/react-select'
import { FlaskConical, X, ChevronDown, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'

type Tier = 'A' | 'B'
type ForProject = 'Omoikiri' | 'News.AI' | 'Nexus.AI' | 'auto'

interface PromoteModalProps {
  slug: string
  autoProject?: string
  /** Status from the candidate card — only show if found/null */
  status?: string | null
  /** Called after a successful 201 to update local state */
  onPromoted?: () => void
}

const PROJECT_OPTIONS: { value: ForProject; label: string }[] = [
  { value: 'auto',     label: 'Авто (из карточки)' },
  { value: 'Omoikiri', label: 'Omoikiri'            },
  { value: 'News.AI',  label: 'News.AI'             },
  { value: 'Nexus.AI', label: 'Nexus.AI'            },
]

function getAdminSecret(): string | null {
  return localStorage.getItem('rd_admin_secret')
}

function setAdminSecret(s: string) {
  localStorage.setItem('rd_admin_secret', s)
}

function clearAdminSecret() {
  localStorage.removeItem('rd_admin_secret')
}

export function PromoteModal({
  slug,
  autoProject,
  status,
  onPromoted,
}: PromoteModalProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  // Form state
  const [tier, setTier] = useState<Tier>('B')
  const [forProject, setForProject] = useState<ForProject>('auto')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Secret prompt state
  const [secretValue, setSecretValue] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [needSecret, setNeedSecret] = useState(false)

  // Only show button for 'found' or null/undefined status
  const eligible = !status || status === 'found'
  if (!eligible) return null

  const handleSubmit = async () => {
    let secret = getAdminSecret()

    if (!secret) {
      if (!secretValue.trim()) {
        setNeedSecret(true)
        return
      }
      secret = secretValue.trim()
      setAdminSecret(secret)
    }

    setSubmitting(true)

    try {
      const resolvedProject = forProject === 'auto' ? (autoProject ?? 'auto') : forProject

      const res = await fetch('/api/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': secret,
        },
        body: JSON.stringify({
          slug,
          tier,
          for: resolvedProject,
          note: note.trim() || undefined,
        }),
      })

      if (res.status === 201) {
        let id = slug
        try {
          const body = await res.json()
          if (body.id) id = body.id
        } catch { /* ignore */ }
        toast({ title: `Поставлено в очередь ${id}`, variant: 'success' })
        onPromoted?.()
        setOpen(false)
        setNote('')
        setNeedSecret(false)
        setSecretValue('')
      } else if (res.status === 401) {
        clearAdminSecret()
        setSecretValue('')
        setNeedSecret(true)
        toast({ title: 'Неверный secret', variant: 'error' })
      } else if (res.status === 409) {
        toast({ title: 'Уже в очереди', variant: 'warning' })
        setOpen(false)
      } else if (res.status === 503) {
        toast({ title: 'GitHub недоступен', description: 'Попробуй через минуту', variant: 'error' })
      } else {
        toast({ title: `Ошибка ${res.status}`, variant: 'error' })
      }
    } catch {
      toast({ title: 'Сетевая ошибка', description: 'Проверь соединение', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
            'bg-accent/10 text-accent border border-accent/20',
            'hover:bg-accent/20 transition-colors shrink-0',
          )}
          title="Взять в изучение"
        >
          <FlaskConical size={13} />
          <span className="hidden sm:inline">Взять в изучение</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-md',
            'bg-card border border-border rounded-xl shadow-xl p-6',
          )}
        >
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-semibold flex items-center gap-2">
              <FlaskConical size={16} className="text-accent" />
              Взять в изучение
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <p className="text-xs text-muted-foreground mb-5 bg-muted px-3 py-2 rounded-lg font-mono truncate">
            {slug}
          </p>

          {/* Tier selection */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2.5 block">Глубина изучения</label>
            <RadioGroup.Root
              value={tier}
              onValueChange={(v) => setTier(v as Tier)}
              className="grid grid-cols-2 gap-2"
            >
              {([
                {
                  value: 'B' as Tier,
                  label: 'Tier B',
                  desc: 'Быстрое, ~5 мин',
                },
                {
                  value: 'A' as Tier,
                  label: 'Tier A',
                  desc: 'Глубокое, ~30 мин',
                },
              ] as const).map((opt) => (
                <RadioGroup.Item key={opt.value} value={opt.value} asChild>
                  <button
                    className={cn(
                      'text-left px-3 py-3 rounded-lg border transition-colors',
                      tier === opt.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-muted-foreground hover:border-accent/40 hover:text-foreground',
                    )}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                  </button>
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
          </div>

          {/* Project select */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Для проекта</label>
            <Select.Root value={forProject} onValueChange={(v) => setForProject(v as ForProject)}>
              <Select.Trigger
                className={cn(
                  'flex items-center justify-between w-full',
                  'px-3 py-2.5 rounded-lg border border-border',
                  'text-sm bg-muted hover:bg-muted/70 transition-colors',
                )}
              >
                <Select.Value />
                <Select.Icon>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="bg-card border border-border rounded-xl shadow-xl z-[60] overflow-hidden"
                  position="popper"
                  sideOffset={4}
                >
                  <Select.Viewport className="p-1">
                    {PROJECT_OPTIONS.map(opt => (
                      <Select.Item
                        key={opt.value}
                        value={opt.value}
                        className={cn(
                          'flex items-center px-3 py-2 rounded-lg text-sm cursor-pointer',
                          'hover:bg-muted outline-none',
                          'data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
                        )}
                      >
                        <Select.ItemText>{opt.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          {/* Note */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">
              Заметка <span className="text-muted-foreground font-normal">(опционально)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Почему интересно, что проверить..."
              rows={2}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border border-border',
                'bg-muted text-sm resize-none',
                'focus:outline-none focus:ring-2 focus:ring-accent/40',
                'placeholder:text-muted-foreground/50',
              )}
            />
          </div>

          {/* Admin secret prompt — shown only if needed */}
          {needSecret && (
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block text-warning">
                Введите admin secret
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  placeholder="secret..."
                  className={cn(
                    'w-full px-3 py-2.5 pr-10 rounded-lg border border-warning/40',
                    'bg-muted text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-warning/40',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Сохранится в localStorage</p>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || (needSecret && !secretValue.trim())}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
              'bg-accent text-accent-foreground text-sm font-semibold',
              'hover:opacity-90 transition-opacity',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
            {submitting ? 'Отправка...' : 'Подтвердить'}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
