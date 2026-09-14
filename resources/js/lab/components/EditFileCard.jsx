import { useId, useMemo, useState } from 'react'
import { ToolStatusText } from './ToolStatusText'
import { DiffPanel, countDiffRows } from './DiffPanel'
import { IconChevron, IconDiff, fileName } from './toolIcons'

/**
 * Small patch tool — separate from full Write; +N −M meta.
 */
export function EditFileCard({
    path = '',
    status = 'done',
    rows = [],
    tokens = null,
    speed = null,
    bytes = null,
    defaultOpen = false,
    onOpenChange,
}) {
    const panelId = useId()
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const [simulatedTokens, setSimulatedTokens] = useState(0)

    useEffect(() => {
        if (status !== 'editing') {
            setSimulatedTokens(0)
            return
        }
        if (tokens != null && tokens > 0) return

        const timer = setInterval(() => {
            setSimulatedTokens((prev) => prev + Math.floor(Math.random() * 5) + 3)
        }, 300)
        return () => clearInterval(timer)
    }, [status, tokens])

    const activeTokens = (tokens != null && tokens > 0) ? tokens : simulatedTokens
    const hasBody = rows.length > 0
    const name = useMemo(() => fileName(path), [path])
    const verb = status === 'editing' ? 'Editing' : 'Edited'
    const { added, removed } = useMemo(() => countDiffRows(rows), [rows])

    const toggle = () => {
        if (! hasBody) return
        const next = ! isOpen
        setIsOpen(next)
        onOpenChange?.(next)
    }

    return (
        <div className="lab-crest-enter min-w-0" role="region" aria-label={`${verb} ${path || name}`}>
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={hasBody && isOpen ? panelId : undefined}
                onClick={toggle}
                className="inline-flex w-full max-w-full min-h-5 min-w-0 appearance-none items-center justify-start gap-1.5 border-0 bg-transparent p-0 m-0 text-left text-[13px] font-normal leading-5 text-inherit group text-krikkit-muted transition-colors hover:text-krikkit-fg-soft"
            >
                <IconDiff />
                <span className="inline-flex min-h-3.5 min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap leading-tight" title={path || name}>
                    <ToolStatusText text={`${verb} ${name}`} pending={status === 'editing'} />
                </span>
                {status === 'editing' && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-500 dark:text-sky-300">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                        </span>
                        <span>Patching</span>
                        {activeTokens > 0 ? (
                            <span className="font-mono text-[10.5px] opacity-90">• {activeTokens} tok</span>
                        ) : null}
                    </span>
                )}
                {(added > 0 || removed > 0) && (
                    <span className="inline-flex shrink-0 items-center gap-1 leading-tight" aria-label={`${added} added, ${removed} removed`}>
                        {tokens != null && tokens > 0 && (
                            <span className="mr-1 text-[11px] font-mono text-krikkit-subtle opacity-80" title={`${tokens} tokens consumed`}>
                                {tokens} tok
                            </span>
                        )}
                        {added > 0 && <span className="text-emerald-500">+{added}</span>}
                        {removed > 0 && <span className="text-red-500">−{removed}</span>}
                    </span>
                )}
                {hasBody && <IconChevron open={isOpen} />}
            </button>

            {status === 'editing' && (
                <div
                    className="mt-1.5 flex items-center justify-between gap-3 rounded-lg border border-krikkit-line/80 bg-krikkit-soft/50 px-2.5 py-1.5 text-[11.5px] text-krikkit-muted shadow-xs transition-all animate-in fade-in duration-200"
                    role="status"
                    aria-live="polite"
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-80"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
                        </span>
                        <span className="font-medium text-krikkit-fg-soft truncate">
                            Generating patch…
                        </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[11px] font-mono text-krikkit-subtle">
                        <span className="inline-flex items-center gap-1 rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-600 dark:text-sky-300">
                            {activeTokens > 0 ? `${activeTokens} tokens consumed` : 'Streaming tokens…'}
                        </span>
                        {speed != null && speed > 0 && (
                            <span className="hidden sm:inline-block text-krikkit-muted">
                                • {speed} tok/s
                            </span>
                        )}
                    </div>
                </div>
            )}

            {hasBody && isOpen ? (
                <div
                    id={panelId}
                    data-state="open"
                    className="lab-tool-collapse"
                >
                    <div className="lab-tool-collapse__clip">
                        <div className="lab-tool-collapse__body">
                            <DiffPanel path={path} rows={rows} label={`Patch for ${path || name}`} />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
