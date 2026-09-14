/**
 * In-browser WebGPU execution engine powered by @mlc-ai/web-llm.
 * Runs Qwen 2.5 Coder 1.5B locally with zero token cost.
 */

import { scrubPseudoToolTags } from './labChatText.js'
import { recoverPseudoToolCalls } from '../orchestration/pseudoToolCalls.js'
import { normalizeVfsPath } from './vfs.js'
import { sanitizeWebLlmGeneratedCode } from './webllmSanitizer.js'

let cachedEngine = null
let cachedEngineModelId = null
let engineInitPromise = null

export function isWebLlmCoder(modelId) {
    if (! modelId) return false
    const s = String(modelId || '').toLowerCase()
    return s.includes('coder') || s.includes('qwen2.5-coder')
}

export function isBuildDisabledForModel(modelId) {
    const s = String(modelId || '').toLowerCase()
    return s.startsWith('webllm') && ! isWebLlmCoder(s)
}

export function isWebGpuSupported() {
    return typeof navigator !== 'undefined'
        && 'gpu' in navigator
        && navigator.gpu !== null
        && typeof navigator.gpu.requestAdapter === 'function'
}

export async function checkWebGpuAvailability() {
    if (! isWebGpuSupported()) {
        return false
    }
    try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
        return adapter !== null
    } catch {
        return false
    }
}

/**
 * Inspect active GPU hardware adapter info (vendor, description, architecture).
 *
 * @returns {Promise<{ description: string, vendor: string, architecture: string, isIntegrated: boolean, hasF16: boolean }|null>}
 */
export async function getWebGpuAdapterDetails() {
    if (! isWebGpuSupported()) return null
    try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
        if (! adapter) return null
        const info = adapter.info || (await adapter.requestAdapterInfo?.()) || {}
        const description = info.description || info.device || info.vendor || 'WebGPU Device'
        const isIntegrated = /intel|uhd|iris|radeon graphics|integrated/i.test(description)
            || /intel/i.test(info.vendor || '')
            || /intel/i.test(info.architecture || '')
        return {
            description,
            vendor: info.vendor || '',
            architecture: info.architecture || '',
            isIntegrated,
            hasF16: Boolean(adapter.features && adapter.features.has('shader-f16')),
        }
    } catch {
        return null
    }
}

export const WEBLLM_MODEL_CONFIGS = {
    'webllm-qwen2-5-coder-1-5b': {
        mlcModelId: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
        displayName: 'Qwen 2.5 Coder 1.5B',
        vram: '~1,630 MB',
        download: '~1.1 GB',
        description: 'In-browser full project build & code generation (WebGPU)',
    },
    'webllm-llama-3-2-1b': {
        mlcModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        displayName: 'Llama 3.2 1B',
        vram: '~879 MB',
        download: '~720 MB',
        description: 'Instruction following, general dialogue, summarization',
    },
    'webllm-qwen2-5-1-5b': {
        mlcModelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
        displayName: 'Qwen 2.5 1.5B',
        vram: '~1,630 MB',
        download: '~1.1 GB',
        description: 'Multilingual chat, structured output (JSON), reasoning',
    },
    'webllm-gemma-2-2b': {
        mlcModelId: 'gemma-2-2b-it-q4f16_1-MLC',
        displayName: 'Gemma 2 2B',
        vram: '~1,895 MB',
        download: '~1.3 GB',
        description: 'High factual density, writing, contextual retrieval',
    },
    'webllm-smollm2-1-7b': {
        mlcModelId: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
        displayName: 'SmolLM2 1.7B',
        vram: '~1,774 MB',
        download: '~1.0 GB',
        description: 'Fast conversational generation, basic tool calls',
    },
    'webllm-qwen2-5-0-5b': {
        mlcModelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
        displayName: 'Qwen 2.5 0.5B',
        vram: '~945 MB',
        download: '~410 MB',
        description: 'Ultra-fast classification, lightweight extraction',
    },
    'webllm-smollm2-360m': {
        mlcModelId: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
        displayName: 'SmolLM2 360M',
        vram: '~376 MB',
        download: '~230 MB',
        description: 'Low-end mobile browser edge cases',
    },
}

export function getMlcModelId(idOrMlc) {
    if (! idOrMlc) return 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC'
    if (WEBLLM_MODEL_CONFIGS[idOrMlc]) {
        return WEBLLM_MODEL_CONFIGS[idOrMlc].mlcModelId
    }
    return idOrMlc
}

export function getCatalogModelId(idOrMlc) {
    if (! idOrMlc) return 'webllm-qwen2-5-coder-1-5b'
    if (WEBLLM_MODEL_CONFIGS[idOrMlc]) return idOrMlc
    for (const [catId, conf] of Object.entries(WEBLLM_MODEL_CONFIGS)) {
        if (conf.mlcModelId === idOrMlc) return catId
    }
    return idOrMlc
}

export function getWebLlmDisplayName(idOrMlc) {
    if (! idOrMlc) return 'WebLLM'
    if (WEBLLM_MODEL_CONFIGS[idOrMlc]) {
        return WEBLLM_MODEL_CONFIGS[idOrMlc].displayName
    }
    for (const conf of Object.values(WEBLLM_MODEL_CONFIGS)) {
        if (conf.mlcModelId === idOrMlc) return conf.displayName
    }
    return String(idOrMlc).replace(/^webllm-/, '').replace(/-MLC$/i, '')
}

/**
 * Checks adapter capabilities and picks q4f16_1 or q4f32_1.
 *
 * @param {string} preferredModelId
 * @returns {Promise<string>}
 */
export async function resolveWebLlmModel(preferredModelId = 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC') {
    if (! isWebGpuSupported()) {
        throw new Error('WebGPU is not supported in this browser. Please use Chrome 113+, Edge 113+, or enable WebGPU flags.')
    }

    const mlcId = getMlcModelId(preferredModelId)

    try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
        if (! adapter) {
            throw new Error('No WebGPU hardware adapter available.')
        }

        const hasF16 = adapter.features && adapter.features.has('shader-f16')
        if (! hasF16 && mlcId.includes('q4f16_1')) {
            // Devices without shader-f16 use 32-bit float quantization
            return mlcId.replace('q4f16_1', 'q4f32_1')
        }
    } catch (err) {
        console.warn('[WebLLM] Adapter feature check fallback:', err)
    }

    return mlcId
}

/**
 * Get or initialize the in-browser MLCEngine.
 *
 * @param {string} modelId
 * @param {((report: { progress: number, text: string }) => void)|null} [onProgress]
 */
export async function getWebLlmEngine(modelId = 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', onProgress = null) {
    const mlcId = getMlcModelId(modelId)
    const resolvedModelId = await resolveWebLlmModel(mlcId)

    if (cachedEngine && cachedEngineModelId === resolvedModelId) {
        return cachedEngine
    }

    if (cachedEngine && cachedEngineModelId !== resolvedModelId) {
        try {
            await cachedEngine.unload()
        } catch {}
        cachedEngine = null
        cachedEngineModelId = null
    }

    if (engineInitPromise) {
        return engineInitPromise
    }

    engineInitPromise = (async () => {
        try {
            const { CreateMLCEngine } = await import('@mlc-ai/web-llm')

            const engine = await CreateMLCEngine(resolvedModelId, {
                initProgressCallback: (report) => {
                    if (typeof onProgress === 'function') {
                        onProgress(report)
                    }
                },
            })

            cachedEngine = engine
            cachedEngineModelId = resolvedModelId
            return engine
        } finally {
            engineInitPromise = null
        }
    })()

    return engineInitPromise
}


/**
 * Build tailored system prompts for in-browser WebLLM execution.
 *
 * @param {{ modelName?: string, contextPack?: object|null, stage?: string|null, autoRepair?: object|null, mode?: string, modelId?: string }} [options]
 * @returns {string}
 */
export function buildWebLlmSystemPrompt({
    modelName = 'WebLLM',
    contextPack = null,
    stage = null,
    autoRepair = null,
    mode = 'chat',
    modelId = '',
} = {}) {
    const pack = contextPack?.pack || contextPack || {}
    const manifest = Array.isArray(pack.manifest) ? pack.manifest : []
    const existingFiles = manifest.map((m) => m.path).filter(Boolean)

    let filesContext = ''
    if (existingFiles.length > 0) {
        filesContext = `\nExisting workspace files:\n${existingFiles.map((f) => `- ${f}`).join('\n')}\n`
    }
    if (contextPack?.canonical_contents && Object.keys(contextPack.canonical_contents).length > 0) {
        // Keep filesContext compact for local WebGPU models to avoid VRAM exhaustion
        const relevantEntries = Object.entries(contextPack.canonical_contents)
            .filter(([p]) => p.includes('src/App') || p.includes('src/main') || p.includes('src/index.css'))
            .slice(0, 2)
        if (relevantEntries.length > 0) {
            filesContext += `\nExisting file contents:\n` + relevantEntries
                .map(([path, content]) => `--- ${path} ---\n${String(content).slice(0, 1200)}`)
                .join('\n\n') + '\n'
        }
    }

    const isCoder = isWebLlmCoder(modelId) || isWebLlmCoder(modelName)
    const isBuildMode = stage === 'build' || stage === 'executor' || mode === 'build' || (isCoder && mode === 'build')

    if (isCoder && isBuildMode) {
        return `You are Votion Lab AI, an expert React and Tailwind CSS engineer powered by ${modelName} running locally in the browser via WebGPU.

ROLE & PERMISSIONS:
You have FULL BUILD MODE permissions to create, edit, and architect web applications directly in the user's project workspace.
You output production-grade, complete, modern React + Tailwind CSS code.

MANDATORY BUILD MODE ACTION:
You are in BUILD MODE. You MUST create, write, or update the workspace code files immediately.
Even if the user's latest prompt is brief (such as "ok", "proceed", "yes", "build", "continue", "start"), do NOT reply with conversational chat or ask questions.
IMMEDIATELY output the complete file implementation in a markdown code block with the path:
\`\`\`jsx src/App.jsx
import React, { useState } from 'react';
// Complete component implementation
export default function App() {
  return (
    <div className="min-h-screen bg-neutral-900 text-white p-6">
      {/* UI code */}
    </div>
  );
}
\`\`\`
Or using XML write_file tags:
<write_file path="src/App.jsx">
// Complete file code
</write_file>

INSTRUCTIONS FOR WRITING CODE:
1. Primary Entry File: The primary component file is ALWAYS \`src/App.jsx\`. Always write the path as \`src/App.jsx\` (never bare \`App.jsx\`).
2. ALLOWED LIBRARIES & COMPONENTS:
- React standard hooks: useState, useEffect, useMemo, useCallback, useRef.
- Standard HTML JSX tags ONLY: <div>, <button>, <input>, <span>, <p>, <h1>, <h2>, <h3>, <ul>, <li>, <nav>, <header>, <section>, <footer>, <form>, <label>, <select>, <textarea>, etc.
- STYLING: ONLY standard Tailwind CSS utility classes (flex, grid, gap, rounded, bg-, text-, border-, shadow-, transition, etc.).
- ICONS: Only import named icons from 'lucide-react' (e.g. import { Search, Heart, Clock, Utensils, Star, X } from 'lucide-react';).
3. STRICT PROHIBITIONS:
- NEVER import from or use 'yup', 'zod', 'react-hook-form', or '@hookform/...'. ALWAYS manage form fields, steps, and validation with standard React useState hooks.
- NEVER import from '@chakra-ui/react', and NEVER use <Box>, <Flex>, <Heading>, or <Skeleton>. Use <div> and standard HTML elements with Tailwind CSS classes instead.
- NEVER import from 'next/router', 'next/navigation', or 'next/link'. This is a Vite React SPA, not Next.js.
- NEVER import from '@tanstack/react-query', 'react-use', or '@mui/...'.
- NEVER import from '@headlessui/react', '@radix-ui/...', or external UI component libraries. Use standard HTML tags with Tailwind CSS.
- NEVER import from non-existent relative local files like './components/...', './lib/...', './mapChrome', './data', './mockData', './places', or './utils'. Define ALL sections (Hero, Works, Services, Process, Contact, Footer), data structures, constants, and helper components inline directly inside the same file.
- NEVER add trailing inline comments to import statements (e.g. write "import { foo } from 'bar';" without trailing comments).
- NEVER import from '@lucide-react/icons'. Always import from 'lucide-react'.
- NEVER fetch from fake external APIs (e.g. do NOT use fetch('https://api.example.com/...')). Define realistic, rich mock data arrays/objects directly inside the component file so the application renders and functions immediately offline.
- For multi-step forms, wizards, or tabs: use simple React state (e.g. const [step, setStep] = useState(1); const [formData, setFormData] = useState({...})).
4. Completeness: Output complete file bodies every time. Do NOT use placeholders like "// rest of code here" or "TODO".${filesContext}`
    }

    return `You are a helpful, fast, local AI assistant (${modelName}) running directly in the user's browser via WebGPU.

Operating Rules:
1. Chat Mode: Your role is conversational: answering questions, explaining code, planning architectures, reviewing code, and giving technical advice.
2. Code Snippets & Explanations: When illustrating code concepts, use standard markdown code fences (e.g. \`\`\`jsx ... \`\`\`) in your response so the user can read and copy them.
3. Build Mode: To execute full automated project builds in the workspace locally, select Qwen 2.5 Coder in Build Mode or switch to a cloud model.
4. Helpful & Direct: Be concise, technically precise, and friendly.${filesContext}`
}

export const WEBLLM_DEFAULT_SYSTEM_PROMPT = buildWebLlmSystemPrompt()

/**
 * Normalize and sanitize chat messages to strictly satisfy WebLLM / MLC-AI constraints:
 * 1. Ensure all message contents are strings (non-VLM throws UserMessageContentErrorForNonVLM if content is array/object).
 * 2. Consolidate any `system` messages into a single system message at index 0
 *    (WebLLM throws SystemMessageOrderError if system message appears at index !== 0).
 * 3. Guarantee that the last message has role 'user' or 'tool'
 *    (WebLLM throws MessageOrderError: "Last message should be from either `user` or `tool`.").
 * 4. Guarantee that messages array is never empty.
 *
 * @param {Array<{ role?: string, content?: unknown }>} rawMessages
 * @param {string} [defaultSystemPrompt]
 * @param {{ stage?: string|null, mode?: string, isBuildMode?: boolean }} [options]
 * @returns {Array<{ role: 'system' | 'user' | 'assistant' | 'tool', content: string }>}
 */
export function normalizeWebLlmMessages(rawMessages = [], defaultSystemPrompt = WEBLLM_DEFAULT_SYSTEM_PROMPT, { stage = null, mode = 'chat', isBuildMode = false } = {}) {
    const list = Array.isArray(rawMessages) ? rawMessages : []
    const systemParts = []
    const conversational = []

    for (const msg of list) {
        if (! msg || typeof msg !== 'object') continue

        const role = String(msg.role || 'user').toLowerCase()
        let content = msg.content
        if (typeof content !== 'string') {
            if (content == null) {
                content = ''
            } else if (typeof content === 'object') {
                try {
                    content = JSON.stringify(content)
                } catch {
                    content = String(content)
                }
            } else {
                content = String(content)
            }
        }

        if (role === 'system') {
            const trimmed = content.trim()
            if (trimmed) {
                systemParts.push(trimmed)
            }
        } else {
            const validRole = (role === 'assistant' || role === 'tool') ? role : 'user'
            conversational.push({
                role: validRole,
                content,
            })
        }
    }

    const result = []

    const combinedSystem = [
        defaultSystemPrompt,
        ...systemParts.filter((p) => p && p !== defaultSystemPrompt),
    ].filter(Boolean).join('\n\n')

    if (combinedSystem) {
        result.push({
            role: 'system',
            content: combinedSystem,
        })
    }

    // Keep conversational history compact for WebLLM: only keep the last 4 messages,
    // and prune large code blocks from older assistant turns to conserve WebGPU KV cache.
    const recentConversational = conversational.slice(-4)
    for (let i = 0; i < recentConversational.length; i++) {
        const msg = { ...recentConversational[i] }
        const isLastTurn = i >= recentConversational.length - 2
        if (! isLastTurn && msg.role === 'assistant' && typeof msg.content === 'string') {
            msg.content = msg.content.replace(/```[\s\S]*?```/g, '[Prior file code omitted for brevity]').slice(0, 500)
        }
        result.push(msg)
    }

    const effectiveBuildMode = Boolean(isBuildMode || stage === 'build' || stage === 'executor' || mode === 'build')

    // WebLLM requires at least one message, and the last message MUST be 'user' or 'tool'
    if (result.length === 0) {
        result.push({
            role: 'user',
            content: 'Please proceed with the project.',
        })
    } else {
        const lastMsg = result[result.length - 1]
        if (lastMsg.role !== 'user' && lastMsg.role !== 'tool') {
            result.push({
                role: 'user',
                content: effectiveBuildMode
                    ? 'Please proceed with writing the files and implementing the requested changes now (src/App.jsx).'
                    : 'Please proceed with writing the files and implementing the requested changes.',
            })
        } else if (effectiveBuildMode && lastMsg.role === 'user') {
            const text = String(lastMsg.content || '').trim().toLowerCase()
            const isShortAffirmation = text.length <= 25 && /^(ok|okay|yes|yep|sure|proceed|start|build|go|do it|continue|let's go|lets go|run|make it|create it|build it)[.!]?$/.test(text)
            if (isShortAffirmation) {
                const originalUser = result.slice(0, -1).filter((m) => m.role === 'user' && String(m.content).trim().length > 10).at(-1)
                const goalDesc = originalUser ? ` to build "${String(originalUser.content).trim().slice(0, 100)}"` : ''
                lastMsg.content = `${lastMsg.content} — please proceed${goalDesc} and write the complete code files (src/App.jsx) now.`
            }
        }
    }

    return result
}

/**
 * Real-time parser for streaming WebLLM output.
 * Detects both completed files and the currently open (streaming) file.
 *
 * @param {string} text
 * @param {{ isBuildMode?: boolean }} [opts]
 * @returns {{ completedFiles: Array<{ path: string, content: string }>, activeFile: { path: string, partialContent: string } | null }}
 */
export function parseStreamingToolState(text = '', { isBuildMode = false } = {}) {
    const completedFiles = []
    let activeFile = null

    // 1. Check XML-style write_file: <write_file path="..."> ... </write_file>
    const xmlOpenRegex = /<write_file(?:\s+(?:path|file)=["']([^"']+)["'][^>]*)?>/gi
    let xmlMatch
    const xmlOpenPositions = []
    while ((xmlMatch = xmlOpenRegex.exec(text)) !== null) {
        xmlOpenPositions.push({
            index: xmlMatch.index,
            headerEnd: xmlMatch.index + xmlMatch[0].length,
            path: (xmlMatch[1] || '').trim(),
        })
    }

    const xmlCloseRegex = /<\/write_file>/gi
    const xmlClosePositions = []
    let xmlCloseMatch
    while ((xmlCloseMatch = xmlCloseRegex.exec(text)) !== null) {
        xmlClosePositions.push({
            index: xmlCloseMatch.index,
            end: xmlCloseMatch.index + xmlCloseMatch[0].length,
        })
    }

    for (let i = 0; i < xmlClosePositions.length; i++) {
        if (i < xmlOpenPositions.length) {
            const open = xmlOpenPositions[i]
            const close = xmlClosePositions[i]
            let body = text.slice(open.headerEnd, close.index)
            let path = open.path
            const pathChild = body.match(/<path>([^<]+)<\/path>/i)
            const contentChild = body.match(/<content>([\s\S]*?)<\/content>/i)
            if (pathChild) path = pathChild[1].trim()
            if (contentChild) body = contentChild[1]
            if (path && body.trim()) {
                const normPath = normalizeVfsPath(path)
                completedFiles.push({ path: normPath, content: sanitizeWebLlmGeneratedCode(body, normPath) })
            }
        }
    }

    if (xmlOpenPositions.length > xmlClosePositions.length) {
        const lastOpen = xmlOpenPositions[xmlOpenPositions.length - 1]
        let body = text.slice(lastOpen.headerEnd)
        let path = lastOpen.path
        const pathChild = body.match(/<path>([^<]+)<\/path>/i)
        if (pathChild) path = pathChild[1].trim()
        if (path) {
            const normPath = normalizeVfsPath(path)
            activeFile = { path: normPath, partialContent: body }
        }
    }

    // 2. Check markdown fences: ```jsx src/App.jsx ... ```
    const fenceParts = text.split('```')
    const completedFencesCount = Math.floor((fenceParts.length - 1) / 2)
    const hasOpenFence = (fenceParts.length % 2) === 0

    for (let i = 1; i <= completedFencesCount * 2; i += 2) {
        const inside = fenceParts[i]
        const firstNewline = inside.indexOf('\n')
        if (firstNewline !== -1) {
            const meta = inside.slice(0, firstNewline).trim()
            const body = inside.slice(firstNewline + 1).replace(/\n$/, '')
            let path = getPathFromFenceMeta(meta, body, isBuildMode)
            if (path && body.trim()) {
                const normPath = normalizeVfsPath(path)
                completedFiles.push({ path: normPath, content: sanitizeWebLlmGeneratedCode(body, normPath) })
            }
        }
    }

    if (hasOpenFence && ! activeFile) {
        const inside = fenceParts[fenceParts.length - 1]
        const firstNewline = inside.indexOf('\n')
        if (firstNewline !== -1) {
            const meta = inside.slice(0, firstNewline).trim()
            const body = inside.slice(firstNewline + 1)
            let path = getPathFromFenceMeta(meta, body, isBuildMode)
            if (path) {
                const normPath = normalizeVfsPath(path)
                activeFile = { path: normPath, partialContent: body }
            }
        }
    }

    return { completedFiles, activeFile }
}

function getPathFromFenceMeta(meta = '', body = '', isBuildMode = false) {
    const parts = meta.split(/\s+/).filter(Boolean)
    let path = parts.find((part) => part.includes('/') || /\.(jsx?|tsx?|css|html|json|md|svg)$/i.test(part))
    if (! path && parts.length === 1 && /\./.test(parts[0])) path = parts[0]

    if (! path && isBuildMode) {
        const lang = (parts[0] || '').toLowerCase()
        if (['jsx', 'tsx', 'react', 'javascript', 'js'].includes(lang)) {
            path = 'src/App.jsx'
        } else if (lang === 'css') {
            path = 'src/index.css'
        }
    }
    return path ? normalizeVfsPath(path) : null
}

/**
 * Run chat generation in the browser via WebGPU.
 *
 * @param {{
 *   modelId?: string,
 *   messages: Array<{ role: string, content: string }>,
 *   onEvent?: (event: { type: string, [key: string]: unknown }) => void,
 *   signal?: AbortSignal|null,
 *   maxTokens?: number,
 *   temperature?: number,
 * }} options
 */
export async function runWebLlmChat({
    modelId = 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    messages = [],
    contextPack = null,
    stage = null,
    autoRepair = null,
    mode = 'chat',
    onEvent = null,
    signal = null,
    maxTokens = 4096,
    temperature = 0.2,
    topP = 0.95,
}) {
    if (! isWebGpuSupported()) {
        throw new Error('WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+ with WebGPU enabled.')
    }

    const mlcId = getMlcModelId(modelId)
    const displayName = getWebLlmDisplayName(modelId)
    const catalogId = getCatalogModelId(modelId)
    const adapterDetails = await getWebGpuAdapterDetails().catch(() => null)
    const gpuName = adapterDetails?.description || 'WebGPU'

    if (typeof onEvent === 'function') {
        onEvent({ type: 'status', label: `Loading ${displayName} on ${gpuName}…` })
    }

    const engine = await getWebLlmEngine(mlcId, (report) => {
        if (typeof onEvent === 'function') {
            const pct = Math.round((report.progress || 0) * 100)
            const text = report.text || `Loading ${displayName}: ${pct}%`
            onEvent({ type: 'status', label: text })
        }
    })

    if (signal?.aborted) {
        const error = new Error('Turn aborted')
        error.code = 'ABORTED'
        throw error
    }

    if (typeof onEvent === 'function' && adapterDetails?.isIntegrated) {
        onEvent({
            type: 'ui',
            callout: {
                tone: 'info',
                text: `WebGPU is running on ${gpuName} (Integrated Graphics). To use your dedicated GPU (NVIDIA/AMD), set your browser to "High performance" in Windows Graphics Settings.`,
            },
        })
    }

    if (typeof onEvent === 'function') {
        onEvent({ type: 'status', label: `${displayName} is thinking (${gpuName})…` })
    }

    const isCoder = isWebLlmCoder(modelId) || isWebLlmCoder(mlcId)
    const isBuildMode = stage === 'build' || stage === 'executor' || mode === 'build' || (isCoder && mode === 'build')

    // Format messages conforming to WebLLM message constraints with rich system prompt
    const systemPrompt = buildWebLlmSystemPrompt({ modelName: displayName, contextPack, stage, autoRepair, mode: isBuildMode ? 'build' : 'chat', modelId: mlcId })
    const chatMessages = normalizeWebLlmMessages(messages, systemPrompt, { stage, mode: isBuildMode ? 'build' : 'chat', isBuildMode })

    const stream = await engine.chat.completions.create({
        messages: chatMessages,
        stream: true,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
    })

    let fullText = ''
    let thoughtText = ''
    let inThought = false
    let lastEmittedProse = ''
    const startedFiles = new Set()
    const endedFiles = new Set()
    let tokenCount = 0

    try {
        for await (const chunk of stream) {
        if (signal?.aborted) {
            await engine.interruptGenerate().catch(() => {})
            const error = new Error('Turn aborted')
            error.code = 'ABORTED'
            throw error
        }

        const delta = chunk.choices?.[0]?.delta?.content || ''
        if (! delta) continue

        fullText += delta
        tokenCount += 1

        // Check for reasoning / thought tags <think>...</think>
        if (fullText.includes('<think>') && ! fullText.includes('</think>')) {
            inThought = true
            const startIndex = fullText.indexOf('<think>') + 7
            thoughtText = fullText.slice(startIndex)
            if (typeof onEvent === 'function') {
                onEvent({ type: 'thought', text: thoughtText })
            }
        } else if (inThought && fullText.includes('</think>')) {
            inThought = false
            const startIndex = fullText.indexOf('<think>') + 7
            const endIndex = fullText.indexOf('</think>')
            thoughtText = fullText.slice(startIndex, endIndex)
        }

        if (! inThought) {
            const cleanText = fullText.replace(/<think>[\s\S]*?<\/think>/g, '').trimStart()

            if (isBuildMode) {
                const toolState = parseStreamingToolState(cleanText, { isBuildMode: true })

                // 1. Emit completed files immediately
                for (const comp of toolState.completedFiles) {
                    if (! endedFiles.has(comp.path)) {
                        if (! startedFiles.has(comp.path)) {
                            startedFiles.add(comp.path)
                            if (typeof onEvent === 'function') {
                                onEvent({ type: 'status', label: `Writing ${comp.path}…` })
                                onEvent({
                                    type: 'tool_start',
                                    id: `webllm_${comp.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                                    name: 'write_file',
                                    arguments: { path: comp.path },
                                })
                            }
                        }
                        endedFiles.add(comp.path)
                        if (typeof onEvent === 'function') {
                            onEvent({
                                type: 'tool_end',
                                id: `webllm_${comp.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                                name: 'write_file',
                                arguments: { path: comp.path, content: comp.content },
                            })
                            onEvent({ type: 'status', label: `Wrote ${comp.path}` })
                        }
                    }
                }

                // 2. Emit active streaming file
                if (toolState.activeFile) {
                    const curPath = toolState.activeFile.path
                    if (! startedFiles.has(curPath)) {
                        startedFiles.add(curPath)
                        if (typeof onEvent === 'function') {
                            onEvent({ type: 'status', label: `Writing ${curPath}…` })
                            onEvent({
                                type: 'tool_start',
                                id: `webllm_${curPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
                                name: 'write_file',
                                arguments: { path: curPath },
                            })
                        }
                    } else if (tokenCount % 10 === 0 && typeof onEvent === 'function') {
                        const bytes = toolState.activeFile.partialContent.length
                        onEvent({ type: 'status', label: `Writing ${curPath} (${bytes} bytes)…` })
                    }
                }
            }

            let scrubbedProse = scrubPseudoToolTags(cleanText)
            if (isBuildMode) {
                // In build mode, strip code blocks that are being written as files so raw code does not leak into chat prose
                scrubbedProse = scrubbedProse.replace(/```(?:jsx?|tsx?|javascript|react)?(?:\s+[^\n]+)?\n[\s\S]*?(?:```|$)/gi, '')
                // Strip partial unclosed code fences e.g. "```jsx" or "```" at stream tail
                scrubbedProse = scrubbedProse.replace(/```[a-zA-Z0-9_./ :-]*$/gi, '').trim()
            }
            if (typeof onEvent === 'function' && scrubbedProse !== lastEmittedProse) {
                lastEmittedProse = scrubbedProse
                onEvent({ type: 'text', text: scrubbedProse })
            }
        }
    }
    } catch (streamErr) {
        console.warn('[WebLLM] Stream ended or encountered exception:', streamErr)
        if (typeof onEvent === 'function') {
            onEvent({ type: 'status', label: 'Finalizing build files…' })
        }
    }

    // Extract thought block if present
    let cleanVisible = fullText
    if (fullText.includes('<think>')) {
        const match = fullText.match(/<think>([\s\S]*?)<\/think>/)
        if (match) {
            thoughtText = match[1].trim()
            cleanVisible = fullText.replace(/<think>[\s\S]*?<\/think>/, '').trim()
        }
    }

    let toolCalls = []
    if (isBuildMode) {
        // Settle any active file that didn't close its fence before EOF
        const finalToolState = parseStreamingToolState(cleanVisible, { isBuildMode: true })
        if (finalToolState.activeFile && ! endedFiles.has(finalToolState.activeFile.path)) {
            const af = finalToolState.activeFile
            endedFiles.add(af.path)
            if (! startedFiles.has(af.path)) {
                startedFiles.add(af.path)
                if (typeof onEvent === 'function') {
                    onEvent({
                        type: 'tool_start',
                        id: `webllm_${af.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                        name: 'write_file',
                        arguments: { path: af.path },
                    })
                }
            }
            if (typeof onEvent === 'function') {
                const cleanContent = sanitizeWebLlmGeneratedCode(af.partialContent, af.path)
                onEvent({
                    type: 'tool_end',
                    id: `webllm_${af.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    name: 'write_file',
                    arguments: { path: af.path, content: cleanContent },
                })
                onEvent({ type: 'status', label: `Wrote ${af.path}` })
            }
        }

        try {
            const canonicalVfs = contextPack?.canonical_contents || {}
            const recovered = recoverPseudoToolCalls(fullText, [], {
                vfsContents: canonicalVfs,
            })
            if (recovered.toolCalls.length > 0) {
                toolCalls = recovered.toolCalls
                for (const call of toolCalls) {
                    if (call.name === 'write_file' && call.arguments?.path) {
                        const p = normalizeVfsPath(call.arguments.path)
                        call.arguments.path = p
                        if (typeof call.arguments.content === 'string') {
                            call.arguments.content = sanitizeWebLlmGeneratedCode(call.arguments.content, p)
                        }
                        if (! endedFiles.has(p)) {
                            if (! startedFiles.has(p)) {
                                startedFiles.add(p)
                                if (typeof onEvent === 'function') {
                                    onEvent({
                                        type: 'tool_start',
                                        id: `webllm_${p.replace(/[^a-zA-Z0-9]/g, '_')}`,
                                        name: 'write_file',
                                        arguments: { path: p },
                                    })
                                }
                            }
                            endedFiles.add(p)
                            if (typeof onEvent === 'function') {
                                onEvent({
                                    type: 'tool_end',
                                    id: `webllm_${p.replace(/[^a-zA-Z0-9]/g, '_')}`,
                                    name: 'write_file',
                                    arguments: call.arguments,
                                })
                                onEvent({ type: 'status', label: `Wrote ${p}` })
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[WebLLM] Tool recovery error:', err)
        }
    }

    cleanVisible = scrubPseudoToolTags(cleanVisible).trim()
    if (isBuildMode) {
        cleanVisible = cleanVisible.replace(/```(?:jsx?|tsx?|javascript|react)?(?:\s+[^\n]+)?\n[\s\S]*?(?:```|$)/gi, '')
        cleanVisible = cleanVisible.replace(/```[a-zA-Z0-9_./ :-]*$/gi, '').trim()
    }
    if (isBuildMode && ! cleanVisible && toolCalls.length > 0) {
        cleanVisible = `Implemented changes in ${toolCalls.map((c) => c.arguments?.path || 'workspace').join(', ')}.`
        if (typeof onEvent === 'function') {
            onEvent({ type: 'text', text: cleanVisible })
        }
    } else if (isBuildMode && ! cleanVisible) {
        cleanVisible = 'Build completed.'
        if (typeof onEvent === 'function') {
            onEvent({ type: 'text', text: cleanVisible })
        }
    }

    return {
        content: cleanVisible,
        thought: thoughtText || null,
        tool_calls: toolCalls,
        propose_workspace: toolCalls.length > 0 || (isCoder && isBuildMode),
        usage: {
            input_tokens: Math.round(fullText.length / 4),
            output_tokens: Math.round(fullText.length / 4),
        },
        model: catalogId,
    }
}

/**
 * Check if a WebLLM model is currently downloaded and cached in the browser.
 *
 * @param {string} modelId
 * @returns {Promise<boolean>}
 */
export async function checkModelInCache(modelId) {
    if (typeof window === 'undefined' || ! ('caches' in window)) {
        return false
    }

    const mlcId = getMlcModelId(modelId)

    try {
        const { hasModelInCache } = await import('@mlc-ai/web-llm')
        let inCache = await hasModelInCache(mlcId).catch(() => false)
        if (! inCache && mlcId.includes('q4f16_1')) {
            const f32 = mlcId.replace('q4f16_1', 'q4f32_1')
            inCache = await hasModelInCache(f32).catch(() => false)
        }
        if (inCache) return true
    } catch {}

    // Secondary probe: inspect cache entries directly for model segments
    try {
        const keys = await window.caches.keys()
        const targetClean = mlcId.toLowerCase().replace(/[^a-z0-9]/g, '')
        for (const key of keys) {
            if (key.toLowerCase().includes('webllm')) {
                const cache = await window.caches.open(key)
                const requests = await cache.keys()
                for (const req of requests) {
                    const u = req.url.toLowerCase()
                    if (u.includes(mlcId.toLowerCase()) || u.includes(targetClean)) {
                        return true
                    }
                }
            }
        }
    } catch {}

    return false
}

/**
 * Delete a specific WebLLM model's weights, wasm, and config from browser cache.
 *
 * @param {string} modelId
 * @returns {Promise<void>}
 */
export async function deleteWebLlmModelCache(modelId) {
    const mlcId = getMlcModelId(modelId)

    // Unload currently running engine if it's using this model
    if (cachedEngine && (cachedEngineModelId === mlcId || cachedEngineModelId?.includes(mlcId))) {
        try {
            await cachedEngine.unload()
        } catch {}
        cachedEngine = null
        cachedEngineModelId = null
    }

    try {
        const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm')
        await deleteModelAllInfoInCache(mlcId).catch(() => {})
        if (mlcId.includes('q4f16_1')) {
            const f32 = mlcId.replace('q4f16_1', 'q4f32_1')
            await deleteModelAllInfoInCache(f32).catch(() => {})
        }
    } catch (err) {
        console.warn('[WebLLM] deleteModelAllInfoInCache error:', err)
    }

    // Secondary purge: delete matching requests across webllm caches
    try {
        if (typeof window !== 'undefined' && 'caches' in window) {
            const keys = await window.caches.keys()
            const targetClean = mlcId.toLowerCase().replace(/[^a-z0-9]/g, '')
            for (const key of keys) {
                if (key.toLowerCase().includes('webllm')) {
                    const cache = await window.caches.open(key)
                    const requests = await cache.keys()
                    for (const req of requests) {
                        const u = req.url.toLowerCase()
                        if (u.includes(mlcId.toLowerCase()) || u.includes(targetClean)) {
                            await cache.delete(req)
                        }
                    }
                }
            }
        }
    } catch {}
}

/**
 * Delete all WebLLM caches from browser CacheStorage.
 *
 * @returns {Promise<void>}
 */
export async function deleteAllWebLlmModelCaches() {
    if (cachedEngine) {
        try {
            await cachedEngine.unload()
        } catch {}
        cachedEngine = null
        cachedEngineModelId = null
    }

    if (typeof window !== 'undefined' && 'caches' in window) {
        try {
            const keys = await window.caches.keys()
            for (const key of keys) {
                if (key.toLowerCase().includes('webllm')) {
                    await window.caches.delete(key)
                }
            }
        } catch (err) {
            console.warn('[WebLLM] Error deleting all WebLLM caches:', err)
        }
    }
}

