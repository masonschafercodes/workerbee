import { Plus, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { Button, Input } from "@workerbee/ui"

export type TopbarProps = {
  readonly workspaceName: string
  readonly query: string
  readonly onQueryChange: (query: string) => void
  readonly onCreateIssue: () => void
}

export function Topbar({
  workspaceName,
  query,
  onQueryChange,
  onCreateIssue,
}: TopbarProps) {
  const [value, setValue] = useState(query)

  useEffect(() => {
    setValue(query)
  }, [query])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (value !== query) {
        onQueryChange(value)
      }
    }, 150)

    return () => window.clearTimeout(timer)
  }, [value, query, onQueryChange])

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
      <span className="truncate text-sm font-medium text-fg lg:hidden">{workspaceName}</span>

      <div className="relative min-w-0 max-w-md flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle"
          aria-hidden="true"
        />
        <Input
          aria-label="Search issues"
          placeholder="Search issues"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-8 pl-8"
        />
      </div>

      <div className="ml-auto">
        <Button
          variant="primary"
          size="sm"
          leading={<Plus className="size-3.5" aria-hidden="true" />}
          onClick={onCreateIssue}
        >
          New issue
        </Button>
      </div>
    </header>
  )
}
