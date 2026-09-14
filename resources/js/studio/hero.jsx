import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SeedChips } from '../lab/components/EmptyLabHero'
import { ModelPicker } from '../lab/components/ModelPicker'
import { fetchLabModels } from '../lab/lib/ai'
import { checkWebGpuAvailability, isWebGpuSupported } from '../lab/lib/webllmEngine'

let mountedChips = null
let mountedPicker = null

function onPickSeed(prompt) {
    window.dispatchEvent(new CustomEvent('studio-seed-prompt', {
        detail: { prompt: String(prompt || ''), send: true },
    }))
}

function StudioModelPickerIsland({ initialPayload }) {
    const [models, setModels] = useState(() => initialPayload?.models || [])
    const [modelId, setModelId] = useState(() => {
        if (typeof window === 'undefined') return null
        try {
            if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu !== null) {
                const saved = localStorage.getItem('votion_lab_preferred_model')
                if (saved && String(saved).toLowerCase().startsWith('webllm')) {
                    return saved
                }
                return 'webllm-qwen2-5-coder-1-5b'
            }
        } catch {}
        try {
            const saved = localStorage.getItem('votion_lab_preferred_model')
            if (saved) return saved
        } catch {}
        return initialPayload?.default || null
    })

    useEffect(() => {
        if (modelId) {
            window.dispatchEvent(new CustomEvent('studio-model-selected', {
                detail: { modelId },
            }))
        }
    }, [])

    useEffect(() => {
        let active = true

        const initModel = async (loadedModels, defaultModel) => {
            let hasWebGpu = false
            try {
                hasWebGpu = isWebGpuSupported() && await checkWebGpuAvailability()
            } catch {
                hasWebGpu = false
            }

            if (! active) return

            let chosenId = null

            if (hasWebGpu) {
                const saved = typeof window !== 'undefined' ? localStorage.getItem('votion_lab_preferred_model') : null
                const savedWebLlm = saved && String(saved).startsWith('webllm') && loadedModels.find((m) => m.id === saved && m.available)
                const defaultWebLlm = loadedModels.find((m) => m.id === 'webllm-qwen2-5-coder-1-5b' && m.available)
                    || loadedModels.find((m) => m.provider === 'webllm' && m.available)

                chosenId = savedWebLlm?.id || defaultWebLlm?.id || null
            } else {
                const saved = typeof window !== 'undefined' ? localStorage.getItem('votion_lab_preferred_model') : null
                if (saved && ! String(saved).toLowerCase().startsWith('webllm') && loadedModels.some((m) => m.id === saved && m.available)) {
                    chosenId = saved
                } else {
                    chosenId = defaultModel || loadedModels.find((m) => m.available && ! String(m.id).toLowerCase().startsWith('webllm'))?.id || null
                }
            }

            setModelId(chosenId)
            if (chosenId) {
                window.dispatchEvent(new CustomEvent('studio-model-selected', {
                    detail: { modelId: chosenId },
                }))
            }
        }

        if (initialPayload?.models?.length) {
            initModel(initialPayload.models, initialPayload.default)
        } else {
            fetchLabModels()
                .then((payload) => {
                    if (! active) return
                    const list = payload?.models || []
                    setModels(list)
                    initModel(list, payload?.default)
                })
                .catch(() => {})
        }

        return () => {
            active = false
        }
    }, [initialPayload])

    useEffect(() => {
        const handleSwitchToCloud = () => {
            const cloudModel = models.find((m) => m.provider !== 'webllm' && m.available)?.id
                || (typeof window !== 'undefined' ? localStorage.getItem('votion_lab_preferred_cloud_model') : null)
                || 'gemini-2.5-flash'
            if (cloudModel) {
                handleSelectModel(cloudModel)
            }
        }
        window.addEventListener('studio-switch-to-cloud-model', handleSwitchToCloud)
        return () => window.removeEventListener('studio-switch-to-cloud-model', handleSwitchToCloud)
    }, [models])

    const handleSelectModel = (nextId) => {
        setModelId(nextId)
        try {
            localStorage.setItem('votion_lab_preferred_model', nextId)
            if (! String(nextId || '').toLowerCase().startsWith('webllm')) {
                localStorage.setItem('votion_lab_preferred_cloud_model', nextId)
            }
        } catch {}
        window.dispatchEvent(new CustomEvent('studio-model-selected', {
            detail: { modelId: nextId },
        }))
    }

    if (! models.length) return null

    return (
        <ModelPicker
            modelId={modelId}
            models={models}
            onSelectModel={handleSelectModel}
        />
    )
}

/**
 * Boot Studio hero React islands:
 * 1. Seed chips (random 4 + refresh + customize)
 * 2. In-composer ModelPicker
 */
export function bootStudioHero() {
    const chipsEl = document.getElementById('studio-seed-chips')
    if (mountedChips?.el !== chipsEl) {
        mountedChips?.root?.unmount()
        mountedChips = null

        if (chipsEl) {
            const root = createRoot(chipsEl)
            root.render(
                <SeedChips live={false} padded={false} onPickSeed={onPickSeed} />,
            )
            mountedChips = { el: chipsEl, root }
        }
    }

    const pickerEl = document.getElementById('studio-model-picker')
    if (mountedPicker?.el !== pickerEl) {
        mountedPicker?.root?.unmount()
        mountedPicker = null

        if (pickerEl) {
            let initialPayload = null
            try {
                if (pickerEl.dataset.models) {
                    initialPayload = JSON.parse(pickerEl.dataset.models)
                }
            } catch {}

            const root = createRoot(pickerEl)
            root.render(
                <StudioModelPickerIsland initialPayload={initialPayload} />,
            )
            mountedPicker = { el: pickerEl, root }
        }
    }
}
