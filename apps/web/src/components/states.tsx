import { Button, Skeleton } from "@workerbee/ui"

export function LoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="grid w-full max-w-sm gap-3" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    </div>
  )
}

export function ErrorScreen({
  message,
  onRetry,
}: {
  readonly message: string
  readonly onRetry?: () => void
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="grid max-w-sm gap-3 text-center">
        <h1 className="text-base font-medium text-fg">Something went wrong</h1>
        <p className="text-sm text-fg-muted">{message}</p>
        {onRetry !== undefined ? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  )
}
