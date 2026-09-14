import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function IconCpu({ className = 'size-3.5' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <rect x="9" y="9" width="6" height="6" />
            <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2" />
        </svg>
    )
}

function IconChevronDown({ className = 'size-3' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
        </svg>
    )
}

function IconCheck({ className = 'size-3.5' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

function IconSparkles({ className = 'size-3.5' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
        </svg>
    )
}

export function ModelPicker({
    modelId,
    models = [],
    onSelectModel,
    disabled = false,
}) {
    const rootRef = useRef(null)
    const menuRef = useRef(null)
    const searchInputRef = useRef(null)
    const menuId = useId()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [menuStyle, setMenuStyle] = useState(null)
    const [placement, setPlacement] = useState('bottom')
    const [gpuInfo, setGpuInfo] = useState(null)

    useEffect(() => {
        let cancelled = false
        import('../lib/webllmEngine.js')
            .then((m) => m.getWebGpuAdapterDetails?.())
            .then((details) => {
                if (! cancelled && details) {
                    setGpuInfo(details)
                }
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [])

    const currentModel = models.find((m) => m.id === modelId)
    const activeLabel = currentModel?.label || modelId || 'Select model'
    const isWebLlm = modelId?.startsWith('webllm')

    const close = () => {
        setOpen(false)
        setQuery('')
    }

    const positionMenu = () => {
        const el = rootRef.current
        if (! el) return
        const rect = el.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        const menuNeed = 280
        const nextPlacement = spaceBelow >= menuNeed || spaceBelow >= spaceAbove ? 'bottom' : 'top'
        setPlacement(nextPlacement)

        const gap = 6
        const menuWidth = 288
        let left = rect.left
        if (left + menuWidth > window.innerWidth - 12) {
            left = Math.max(12, rect.right - menuWidth)
        }

        if (nextPlacement === 'bottom') {
            setMenuStyle({
                position: 'fixed',
                top: rect.bottom + gap,
                left,
                zIndex: 130,
            })
        } else {
            setMenuStyle({
                position: 'fixed',
                bottom: window.innerHeight - rect.top + gap,
                left,
                zIndex: 130,
            })
        }
    }

    useLayoutEffect(() => {
        if (! open) {
            setMenuStyle(null)
            return
        }
        positionMenu()
    }, [open])

    useEffect(() => {
        if (! open) return
        const handleReflow = () => positionMenu()
        window.addEventListener('resize', handleReflow, { passive: true })
        window.addEventListener('scroll', handleReflow, { capture: true, passive: true })
        return () => {
            window.removeEventListener('resize', handleReflow)
            window.removeEventListener('scroll', handleReflow, { capture: true })
        }
    }, [open])

    useEffect(() => {
        if (! open) return
        const onDocClick = (e) => {
            if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) {
                return
            }
            close()
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [open])

    useEffect(() => {
        if (! open) return
        const onKey = (e) => {
            if (e.key === 'Escape') close()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open])

    useEffect(() => {
        if (open && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [open])

    const filteredModels = models.filter((m) => {
        if (! query.trim()) return true
        const q = query.toLowerCase()
        return m.label.toLowerCase().includes(q)
            || m.id.toLowerCase().includes(q)
            || (m.provider || '').toLowerCase().includes(q)
    })

    const webLlmModels = filteredModels.filter((m) => m.provider === 'webllm')
    const cloudModels = filteredModels.filter((m) => m.provider !== 'webllm')

    const menu = open && menuStyle ? createPortal(
        <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Select AI Model"
            style={menuStyle}
            className={[
                'w-72 max-w-[calc(100vw-24px)] rounded-xl border border-krikkit-line bg-[color-mix(in_oklab,var(--color-krikkit-canvas)_65%,var(--color-krikkit-surface)_35%)] p-1.5 shadow-2xl backdrop-blur-xl',
                placement === 'top' ? 'origin-bottom-left' : 'origin-top-left',
            ].join(' ')}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="mb-1.5 px-1 pt-0.5">
                <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search models…"
                    className="w-full rounded-lg border border-krikkit-line/70 bg-krikkit-surface/60 px-2.5 py-1.5 text-xs text-krikkit-fg placeholder:text-krikkit-subtle focus:border-accent focus:outline-none"
                />
            </div>

            <div className="max-h-64 overflow-y-auto krikkit-scroll-hover space-y-2 py-0.5">
                {/* In-Browser WebGPU Models */}
                {webLlmModels.length > 0 && (
                    <div>
                        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-krikkit-subtle">
                            <IconCpu className="size-3" />
                            <span>In-Browser WebGPU (Free · 0 Credits · Chat only)</span>
                        </div>

                        {gpuInfo && (
                            <div className="mx-2 mb-2 rounded-lg border border-krikkit-line/60 bg-krikkit-surface/50 p-2 text-[11px] leading-snug">
                                <div className="flex items-center justify-between gap-1.5 font-medium text-krikkit-fg">
                                    <span className="truncate text-[11px]" title={gpuInfo.description}>
                                        {gpuInfo.description}
                                    </span>
                                    <span className="shrink-0 rounded bg-krikkit-soft px-1.5 py-0.5 text-[9px] font-semibold text-krikkit-subtle">
                                        {gpuInfo.isIntegrated ? 'Integrated GPU' : 'Dedicated GPU'}
                                    </span>
                                </div>
                                {gpuInfo.isIntegrated && (
                                    <p className="mt-1.5 text-[10px] text-krikkit-muted">
                                        💡 Running on integrated graphics. To use your dedicated GPU (NVIDIA/AMD), set your browser to <span className="font-semibold text-krikkit-fg">High performance</span> in Windows Graphics Settings.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="space-y-0.5">
                            {webLlmModels.map((m) => {
                                const active = m.id === modelId
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                            onSelectModel(m.id)
                                            close()
                                        }}
                                        className={[
                                            'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition',
                                            active
                                                ? 'bg-accent/15 text-accent-foreground font-medium'
                                                : 'text-krikkit-fg-soft hover:bg-krikkit-soft hover:text-krikkit-fg',
                                        ].join(' ')}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="truncate">{m.label.replace(/\s*\(WebLLM.*?\)/i, '')}</span>
                                                <span className="shrink-0 rounded bg-krikkit-soft px-1.5 py-0.5 text-[9px] font-medium text-krikkit-subtle">
                                                    {m.vram || 'Local'}
                                                </span>
                                                <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium text-accent-content">
                                                    {m.id.includes('coder') ? 'Full build' : 'Chat only'}
                                                </span>
                                            </div>
                                            <p className="truncate text-[10px] text-krikkit-muted" title={m.description || ''}>
                                                {m.description || (gpuInfo?.description ? `Runs on ${gpuInfo.description} · ${m.id.includes('coder') ? 'Full build & chat' : 'Chat mode only'}` : `Runs on device GPU via WebLLM · ${m.id.includes('coder') ? 'Full build & chat' : 'Chat mode only'}`)}
                                            </p>
                                        </div>
                                        {active && <IconCheck className="size-3.5 shrink-0 text-accent" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Cloud Provider Models */}
                {cloudModels.length > 0 && (
                    <div>
                        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-krikkit-subtle">
                            <IconSparkles className="size-3" />
                            <span>Cloud Models</span>
                        </div>
                        <div className="space-y-0.5">
                            {cloudModels.map((m) => {
                                const active = m.id === modelId
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                            onSelectModel(m.id)
                                            close()
                                        }}
                                        className={[
                                            'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition',
                                            active
                                                ? 'bg-accent/15 text-accent-foreground font-medium'
                                                : 'text-krikkit-fg-soft hover:bg-krikkit-soft hover:text-krikkit-fg',
                                        ].join(' ')}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <span className="block truncate">{m.label}</span>
                                            <span className="block truncate text-[10px] text-krikkit-muted">
                                                {m.provider ? m.provider.toUpperCase() : 'CLOUD'}
                                            </span>
                                        </div>
                                        {active && <IconCheck className="size-3.5 shrink-0 text-accent" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {filteredModels.length === 0 && (
                    <p className="px-3 py-3 text-center text-xs text-krikkit-muted">
                        No models matching “{query}”
                    </p>
                )}
            </div>
        </div>,
        document.body,
    ) : null

    return (
        <div ref={rootRef} className="relative inline-flex items-center">
            <button
                type="button"
                onClick={() => setOpen((prev) => ! prev)}
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={open}
                className={[
                    'inline-flex h-8 max-w-[160px] sm:max-w-[200px] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition',
                    'text-krikkit-muted hover:bg-krikkit-soft hover:text-krikkit-fg',
                    open ? 'bg-krikkit-soft text-krikkit-fg' : '',
                    disabled ? 'pointer-events-none opacity-50' : '',
                ].join(' ')}
                title={activeLabel}
            >
                {isWebLlm ? (
                    <IconCpu className="size-3.5 shrink-0 text-krikkit-muted" />
                ) : (
                    <IconSparkles className="size-3.5 shrink-0 text-krikkit-muted" />
                )}
                <span className="truncate">{activeLabel.replace(/\s*\(.*?\)/g, '')}</span>
                <IconChevronDown className="size-3 shrink-0 opacity-60" />
            </button>

            {menu}
        </div>
    )
}
