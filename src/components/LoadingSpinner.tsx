import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="animate-spin text-accent mb-3" size={32} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
