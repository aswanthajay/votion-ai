import { useEffect, useId, useMemo, useState } from 'react'
import { ToolStatusText } from './ToolStatusText'
import { DiffPanel, countDiffRows } from './DiffPanel'
import { IconChevron, fileName } from './toolIcons'

function IconPen({ className = 'h-3.5 w-3.5' }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    )
}

/**
 * Full-file write tool — dense diff of the new body.
 */
export function WriteFileCard({
    path = '',
    status = 'done',
    rows = [],
    detail = '',
    tokens = null,
    speed = null,
    bytes = null,
    defaultOpen = false,
    onOpenChange,
    staticEnter = false,
}) {
    const panelId = useId()
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const [simulatedTokens, setSimulatedTokens] = useState(0)

    useEffect(() => {
        if (status !== 'writing') {
            setSimulatedTokens(0)
            return
        }
        if (tokens != null && tokens > 0) return

        // Smooth ticker during writing if live count is awaiting first SSE frame
        const timer = setInterval(() => {
            setSimulatedTokens((prev) => prev + Math.floor(Math.random() * 6) + 4)
        }, 280)
        return () => clearInterval(timer)
    }, [status, tokens])

    const activeTokens = (tokens != null && tokens > 0) ? tokens : simulatedTokens
    const hasBody = rows.length > 0
    const name = String(path || '').trim() ? fileName(path) : 'file'
    const verb = status === 'writing'
        ? 'Writing'
        : (status === 'error' ? 'Write failed' : 'Wrote')
    const { added, removed } = useMemo(() => countDiffRows(rows), [rows])

    const toggle = () => {
        if (! hasBody) return
        const next = ! isOpen
        setIsOpen(next)
        onOpenChange?.(next)
    }

    return (
        <div
            className={['lab-crest-enter min-w-0', staticEnter ? 'lab-crest-enter--static' : ''].join(' ')}
            role="region"
            aria-label={`${verb} ${path || name}`}
            data-lab-chrome="writeFile"
        >
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={hasBody && isOpen ? panelId : undefined}
                onClick={toggle}
                className={[
                    'inline-flex w-full max-w-full min-h-5 min-w-0 appearance-none items-center justify-start gap-1.5 border-0 bg-transparent p-0 m-0 text-left text-[13px] font-normal leading-5 text-inherit group transition-colors',
                    status === 'error'
                        ? 'text-red-500/90 dark:text-red-400/90 hover:text-red-600 dark:hover:text-red-300'
                        : 'text-krikkit-muted hover:text-krikkit-fg-soft',
                ].join(' ')}
            >
                <IconPen className={['h-3.5 w-3.5 shrink-0', status === 'error' ? 'text-red-500 dark:text-red-400' : ''].filter(Boolean).join(' ')} />
                <span className="inline-flex min-h-3.5 min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap leading-tight" title={path || name}>
                    <ToolStatusText text={`${verb} ${name}`} pending={status === 'writing'} />
                </span>
                {status === 'writing' && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-500 dark:text-sky-300">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                        </span>
                        <span>Generating</span>
                        {activeTokens > 0 ? (
                            <span className="font-mono text-[10.5px] opacity-90">• {activeTokens} tok</span>
                        ) : null}
                    </span>
                )}
                {status === 'error' && detail ? (
                    <span
                        className="max-w-[14rem] shrink-0 truncate rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-600 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300"
                        title={detail}
                    >
                        {detail}
                    </span>
                ) : null}
                {(added > 0 || removed > 0) && (
                    <span className="inline-flex shrink-0 items-center gap-1 leading-tight" aria-label={`${added} added, ${removed} removed`}>
                        {tokens != null && tokens > 0 && (
                            <span className="mr-1 text-[11px] font-mono text-krikkit-subtle opacity-80" title={`${tokens} tokens consumed`}>
                                {tokens} tok
                            </span>
                        )}
                        {added > 0 && <span className="text-emerald-500">+{added}</span>}
                        {removed > 0 && <span className="text-red-500">-{removed}</span>}
                    </span>
                )}
                {hasBody && <IconChevron open={isOpen} />}
            </button>

            {/* Small, clean and neat status box while writing */}
            {status === 'writing' && (
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
                            Generating content…
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
                        {bytes != null && bytes > 0 && (
                            <span className="hidden sm:inline-block text-krikkit-muted">
                                • {(bytes / 1024).toFixed(1)} KB
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Mount only when open — closed 0fr/hidden panels still leak gap under the row. */}
            {hasBody && isOpen ? (
                <div
                    id={panelId}
                    data-state="open"
                    className="lab-tool-collapse"
                >
                    <div className="lab-tool-collapse__clip">
                        <div className="lab-tool-collapse__body">
                            <DiffPanel rows={rows} />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
