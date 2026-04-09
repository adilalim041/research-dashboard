import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  message: string
  onRetry?: () => void
}

export function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <AlertCircle className="text-danger mb-3" size={32} />
      <p className="text-sm text-danger mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  )
}
