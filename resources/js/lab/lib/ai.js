import { pruneConversationMessages } from '../orchestration/messagePrune.js'

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

function networkErrorMessage(error) {
    const raw = String(error?.message || error || 'Network error')
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
        return [
            'Network error talking to Lab (Failed to fetch).',
            'Usually the PHP→provider call hung (WSL DNS / HTTP_PROXY) or the page is not on the Laravel origin (use :8000, not Vite :5173).',
            'Restart `composer run dev` in a normal terminal, or check Dashboard → AI settings / provider keys.',
        ].join(' ')
    }
    return raw
}

async function parseJson(response) {
    const data = await response.json().catch(() => ({}))
    if (! response.ok) {
        const error = new Error(data.message || `Request failed (${response.status})`)
        error.status = response.status
        error.payload = data
        throw error
    }
    return data
}

export async function fetchLabModels() {
    const response = await fetch('/lab/models', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    })
    return parseJson(response)
}

/**
 * @param {{
 *   model?: string,
 *   project?: string,
 *   messages: Array<{ role: 'user' | 'assistant', content: string }>,
 *   stage?: string,
 *   context_pack?: object,
 *   tools?: array,
 *   tool_choice?: string|object,
 *   persist_user?: boolean,
 *   persist_assistant?: boolean,
 *   auto_repair?: object,
 *   preview_edits?: array,
 * }} payload
 * @param {{
 *   signal?: AbortSignal|null,
 *   onEvent?: ((event: { type: string, [key: string]: unknown }) => void) | null,
 * }} [options]
 */
export async function sendLabChat(payload, options = {}) {
    const model = String(payload?.model || '')
    if (model.startsWith('webllm')) {
        return executeWebLlmChat(payload, options)
    }

    const signal = options.signal || null
    const onEvent = typeof options.onEvent === 'function' ? options.onEvent : null
    const body = {
        ...payload,
        messages: pruneConversationMessages(payload?.messages || []),
        ...(onEvent ? { stream: true } : {}),
    }
    let response
    try {
        response = await fetch('/lab/chat', {
            method: 'POST',
            headers: {
                Accept: onEvent ? 'text/event-stream, application/json' : 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify(body),
            ...(signal ? { signal } : {}),
        })
    } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') {
            throw abortedError(error)
        }
        const wrapped = new Error(networkErrorMessage(error))
        wrapped.cause = error
        throw wrapped
    }

    const contentType = String(response.headers.get('content-type') || '')
    if (onEvent && /text\/event-stream/i.test(contentType) && response.body) {
        return readLabChatSse(response, { onEvent, signal })
    }

    return parseJson(response)
}

async function executeWebLlmChat(payload, options = {}) {
    const signal = options.signal || null
    const onEvent = typeof options.onEvent === 'function' ? options.onEvent : null

    const { runWebLlmChat, isWebGpuSupported } = await import('./webllmEngine.js')

    if (! isWebGpuSupported()) {
        throw new Error('WebGPU is not supported in this browser. Please use Chrome 113+, Edge 113+, or enable WebGPU flags.')
    }

    const prunedMessages = pruneConversationMessages(payload?.messages || [])
    const modelToRun = payload?.model || 'webllm-qwen2-5-coder-1-5b'

    // Execute locally via in-browser WebGPU
    const localResult = await runWebLlmChat({
        modelId: modelToRun,
        messages: prunedMessages,
        contextPack: payload?.context_pack || null,
        stage: payload?.stage || null,
        autoRepair: payload?.auto_repair || null,
        mode: payload?.mode || (payload?.stage === 'build' || payload?.stage === 'executor' ? 'build' : 'chat'),
        onEvent,
        signal,
        maxTokens: 4096,
    })

    if (signal?.aborted) {
        throw abortedError()
    }

    // Synchronize completion with Laravel to persist project, turns, and metadata
    const syncBody = {
        ...payload,
        messages: prunedMessages,
        client_completion: {
            content: localResult.content,
            thought: localResult.thought,
            tool_calls: localResult.tool_calls || [],
            propose_workspace: Boolean(localResult.propose_workspace),
            usage: localResult.usage,
            finish_reason: 'stop',
        },
    }

    try {
        const response = await fetch('/lab/chat', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify(syncBody),
            ...(signal ? { signal } : {}),
        })

        if (response.ok) {
            const data = await response.json()
            // If server turn response is missing tool_calls or empty, preserve local tool_calls
            if ((! data.tool_calls || ! data.tool_calls.length) && localResult.tool_calls?.length) {
                data.tool_calls = localResult.tool_calls
            }
            return data
        }
    } catch (err) {
        console.warn('[WebLLM] Turn sync warning:', err)
    }

    // Fallback response if offline/network error during sync
    return {
        content: localResult.content,
        model: localResult.model || modelToRun,
        provider: 'webllm',
        stage: payload.stage,
        propose_workspace: Boolean(localResult.propose_workspace),
        thought: localResult.thought,
        suggestions: [],
        todos: [],
        tool_calls: localResult.tool_calls || [],
        assistant_message_id: null,
        usage: localResult.usage,
        is_byok: true,
        credits: { charged: 0, byok: true },
        finish_reason: 'stop',
        project: payload.project ? { uuid: payload.project } : null,
    }
}

function abortedError(cause = null) {
    const aborted = new Error('Turn aborted')
    aborted.code = 'ABORTED'
    aborted.name = 'AbortError'
    if (cause) aborted.cause = cause
    return aborted
}

function parseSseBlock(block) {
    const raw = String(block || '')
    if (! raw.trim()) return null
    let event = 'message'
    const dataLines = []
    for (const line of raw.split(/\r?\n/)) {
        if (! line || line.startsWith(':')) continue
        if (line.startsWith('event:')) {
            event = line.slice(6).trim() || 'message'
            continue
        }
        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
        }
    }
    if (! dataLines.length) return null
    let data = dataLines.join('\n')
    try {
        data = JSON.parse(data)
    } catch {
        /* keep raw string for [DONE] / malformed */
    }
    return { event, data }
}

async function readLabChatSse(response, { onEvent, signal }) {
    if (! response.ok) {
        return parseJson(response)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let donePayload = null

    const failIfAborted = () => {
        if (signal?.aborted) throw abortedError()
    }

    try {
        while (true) {
            failIfAborted()
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split(/\r?\n\r?\n/)
            buffer = parts.pop() || ''
            for (const block of parts) {
                const parsed = parseSseBlock(block)
                if (! parsed) continue
                if (parsed.event === 'done') {
                    donePayload = parsed.data && typeof parsed.data === 'object' ? parsed.data : {}
                    continue
                }
                if (parsed.event === 'error') {
                    const payload = parsed.data && typeof parsed.data === 'object' ? parsed.data : {}
                    const error = new Error(payload.message || 'Chat request failed.')
                    error.status = Number(payload.status) || 502
                    error.payload = payload
                    throw error
                }
                if (parsed.data && typeof parsed.data === 'object') {
                    onEvent({ type: parsed.event, ...parsed.data })
                }
            }
        }
    } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError' || error?.code === 'ABORTED') {
            throw abortedError(error)
        }
        throw error
    } finally {
        try {
            reader.releaseLock()
        } catch {
            /* ignore */
        }
    }

    if (buffer.trim()) {
        const parsed = parseSseBlock(buffer)
        if (parsed?.event === 'done' && parsed.data && typeof parsed.data === 'object') {
            donePayload = parsed.data
        } else if (parsed?.event === 'error') {
            const payload = parsed.data && typeof parsed.data === 'object' ? parsed.data : {}
            const error = new Error(payload.message || 'Chat request failed.')
            error.status = Number(payload.status) || 502
            error.payload = payload
            throw error
        } else if (parsed?.data && typeof parsed.data === 'object') {
            onEvent({ type: parsed.event, ...parsed.data })
        }
    }

    if (! donePayload || typeof donePayload !== 'object') {
        throw new Error('Chat stream ended without a result.')
    }

    return donePayload
}

/**
 * Persist thinking / tool activity / checklist chrome for an assistant turn.
 *
 * @param {string} projectUuid
 * @param {{
 *   message_id?: number|null,
 *   content?: string|null,
 *   metadata: Record<string, unknown>,
 * }} payload
 */
export async function persistLabTurnState(projectUuid, payload) {
    if (! projectUuid) return null
    if (! payload?.metadata || typeof payload.metadata !== 'object') return null
    if (Object.keys(payload.metadata).length === 0) return null
    let response
    try {
        response = await fetch(`/lab/${encodeURIComponent(projectUuid)}/turn-state`, {
            method: 'PUT',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        })
    } catch (error) {
        const wrapped = new Error(networkErrorMessage(error))
        wrapped.cause = error
        throw wrapped
    }
    return parseJson(response)
}

/**
 * Diagnostics only — writes to laravel.log via /lab/{uuid}/events.
 * Never paints UI. Fire-and-forget; failures are swallowed.
 *
 * @param {string|null|undefined} projectUuid
 * @param {Record<string, unknown>|Array<Record<string, unknown>>} events
 */
export function reportLabEvents(projectUuid, events) {
    const uuid = String(projectUuid || '').trim()
    if (! uuid) return
    const list = (Array.isArray(events) ? events : [events])
        .filter((row) => row && typeof row === 'object' && row.type)
        .slice(0, 40)
    if (! list.length) return

    try {
        void fetch(`/lab/${encodeURIComponent(uuid)}/events`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify({ events: list }),
            keepalive: true,
        }).catch(() => {})
    } catch {
        /* ignore */
    }
}

/**
 * Build a complete write_file diagnostic payload for laravel.log (no UI).
 *
 * @param {{
 *   path?: string,
 *   status?: string,
 *   observation?: object|null,
 *   content?: string,
 *   before?: string,
 *   after?: string,
 *   meta?: Record<string, unknown>,
 * }} args
 */
export function buildWriteFileLogEvent(args = {}) {
    const content = String(args.content ?? '')
    const before = String(args.before ?? '')
    const observation = args.observation && typeof args.observation === 'object'
        ? args.observation
        : null
    const rawArtifacts = observation?.artifacts && typeof observation.artifacts === 'object'
        ? observation.artifacts
        : {}

    // Keep only diagnostic fields — never dump full file bodies into laravel.log.
    const artifacts = {
        gate: rawArtifacts.gate ?? null,
        errorType: rawArtifacts.errorType ?? null,
        message: rawArtifacts.message
            ? String(rawArtifacts.message).slice(0, 200)
            : null,
        line: rawArtifacts.line ?? null,
        column: rawArtifacts.column ?? null,
    }

    const oneLine = (text, max) => String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)

    return {
        type: 'lab.write_reject',
        tool: 'write_file',
        path: String(args.path || rawArtifacts.path || ''),
        status: String(args.status || observation?.status || ''),
        hint: observation?.hint ?? null,
        errorClass: observation?.errorClass ?? null,
        summary: oneLine(observation?.summary || '', 240),
        artifacts,
        contentBytes: content.length,
        beforeBytes: before.length,
        contentHead: oneLine(content, 120),
        contentTail: content.length > 160 ? oneLine(content.slice(-80), 80) : '',
        contentFingerprint: fingerprintHex(content),
    }
}

/** Lightweight non-crypto fingerprint for log correlation. */
function fingerprintHex(text = '') {
    let h = 2166136261
    const s = String(text || '')
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return (`00000000${(h >>> 0).toString(16)}`).slice(-8)
}
