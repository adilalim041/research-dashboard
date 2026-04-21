/**
 * Minimal toast system using Radix Toast primitives.
 * Usage:
 *   const { toast } = useToast()
 *   toast({ title: 'Done', variant: 'success' })
 *
 *   Render <Toaster /> once at the app root (inside Layout).
 */
import * as RadixToast from '@radix-ui/react-toast'
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

interface ToastContextValue {
  toast: (msg: Omit<ToastMessage, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-400',
  error:   'border-danger/30 bg-danger/10 text-danger',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info:    'border-accent/30 bg-accent/10 text-accent',
}

const VARIANT_ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={16} />,
  error:   <AlertCircle size={16} />,
  warning: <AlertCircle size={16} />,
  info:    <Info size={16} />,
}

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: (id: string) => void }) {
  const variant = msg.variant ?? 'info'
  return (
    <RadixToast.Root
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border shadow-lg',
        'data-[state=open]:animate-in data-[state=open]:slide-in-from-right-8',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-80',
        'bg-card',
        VARIANT_STYLES[variant],
      )}
      duration={4000}
      onOpenChange={(open) => { if (!open) onDismiss(msg.id) }}
    >
      <span className="shrink-0 mt-0.5">{VARIANT_ICONS[variant]}</span>
      <div className="flex-1 min-w-0">
        <RadixToast.Title className="text-sm font-semibold">{msg.title}</RadixToast.Title>
        {msg.description && (
          <RadixToast.Description className="text-xs opacity-80 mt-0.5">
            {msg.description}
          </RadixToast.Description>
        )}
      </div>
      <RadixToast.Close asChild>
        <button className="shrink-0 mt-0.5 hover:opacity-70 transition-opacity">
          <X size={14} />
        </button>
      </RadixToast.Close>
    </RadixToast.Root>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const toast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = String(Date.now()) + Math.random()
    setMessages(prev => [...prev.slice(-4), { ...msg, id }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <RadixToast.Provider swipeDirection="right">
        {children}
        {messages.map(msg => (
          <ToastItem key={msg.id} msg={msg} onDismiss={dismiss} />
        ))}
        <RadixToast.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)]" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  )
}
