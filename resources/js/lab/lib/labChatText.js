import {
    scrubSuggestionArtifacts,
    scrubTodoArtifacts,
    streamRevealSafe,
} from '../orchestration/index.js'
import { createBackgroundFrameLoop } from './backgroundFrame.js'
import { getExtension, getLanguageIdentifier, isImageAttachment } from './attachments.js'

function getSafeCodeFence(content = '') {
    let fence = '```'
    while (content.includes(fence)) {
        fence += '`'
    }
    return fence
}

/** Text-only content for the gateway (shared lab prompt lives on the server). */
export function userContentForApi(text, files = []) {
    const body = String(text || '').trim()
    const safeFiles = Array.isArray(files) ? files.filter(Boolean) : []
    if (! safeFiles.length) return body

    const codeBlocks = []
    const stubFiles = []

    for (const file of safeFiles) {
        const name = file.name || file.label || 'file'
        const rawContent = typeof file.content === 'string' ? file.content.trim() : ''

        if (rawContent) {
            const ext = file.ext || getExtension(name)
            const lang = getLanguageIdentifier(ext)
            const fence = getSafeCodeFence(rawContent)
            codeBlocks.push(`[Attached File: ${name}]\n${fence}${lang}\n${rawContent}\n${fence}`)
        } else if (file.kind === 'image' || isImageAttachment(file)) {
            stubFiles.push(`[Attached Image: ${name}]`)
        } else {
            stubFiles.push(`[Attached File: ${name}]`)
        }
    }

    const parts = []
    if (body) parts.push(body)
    if (codeBlocks.length) parts.push(codeBlocks.join('\n\n'))
    if (stubFiles.length) parts.push(stubFiles.join('\n'))

    return parts.join('\n\n').trim()
}

export function packFiles(items) {
    if (! Array.isArray(items)) return []
    return items.filter(Boolean).map((item) => ({
        id: item.id,
        url: item.url,
        name: item.name,
        type: item.type,
        size: item.size,
        kind: item.kind,
        label: item.label,
        toneClass: item.toneClass,
        ext: item.ext,
        content: typeof item.content === 'string' ? item.content : null,
    }))
}

export function stripAttachedFilesFromContent(content = '') {
    const raw = String(content || '').trim()
    if (! raw.includes('[Attached File:') && ! raw.includes('[Attached Image:') && ! raw.includes('[Attachments:')) {
        return raw
    }
    if (/^\[(?:Attached File|Attached Image|Attachments):/i.test(raw)) {
        return ''
    }
    const splitIdx = raw.search(/\n\s*\[(?:Attached File|Attached Image|Attachments):/i)
    if (splitIdx >= 0) {
        return raw.slice(0, splitIdx).trim()
    }
    return raw
}

/** Explicit user phrases that re-arm the BuildGate / start build after Skip. */
export const USER_RESUME_BUILD_GATE = /\b(build\s+(it|now)|start\s+building|let'?s\s+(build|go|start)|ok(ay)?[,.]?\s*start|open\s+workspace)\b/iu

/**
 * Discovery reply is ready for the Switch card even if the model forgot
 * the propose_workspace meta. A trailing question still means “ask first”.
 */
export function discoveryReadyForBuild(bot = '') {
    const text = String(bot || '').trim()
    if (! text) return false
    if (/<suggestions>/i.test(text)) return false
    const tail = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-3)
        .join(' ')
    if (/\?\s*$/.test(tail)) return false
    return true
}

/** Wire-only Skip signal for Claude/OpenAI — never shown in chat UI / never persisted. */
export const BUILD_PROPOSAL_REJECTED_EVENT = '[EVENT: BUILD_PROPOSAL_REJECTED]'

/** Discovery chat must not become a code dump — strip fenced blocks and XML pseudo-tools from visible replies. */
export function redactDiscoveryCodeDumps(text = '') {
    let removed = false
    let out = String(text || '')
    // Strip all code fences (both closed and streaming unclosed)
    out = out.replace(/```[^\n`]*\n?[\s\S]*?(?:```|$)/g, () => {
        removed = true
        return ''
    })
    out = out.replace(/<(?:write_file|read_file|list_dir|grep|file_search|lookup_visuals|survey_datastore|revise_datastore|github_[a-z_]+)>\s*(?:<path>[^<]+<\/path>\s*)?(?:<content>[\s\S]*?<\/content>\s*)?<\/(?:write_file|read_file|list_dir|grep|file_search|lookup_visuals|survey_datastore|revise_datastore|github_[a-z_]+)>/giu, () => {
        removed = true
        return ''
    })
    out = out.replace(/<lookup_visuals>\s*[\s\S]*?\s*<\/lookup_visuals>/giu, () => {
        removed = true
        return ''
    })
    const clean = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (! removed) return clean
    if (clean) return clean

    return 'Code belongs in the workspace, not chat. Let’s keep refining direction here.'
}

/** Past-tense “I already shipped this” — discovery has no VFS writes yet. */
const FAKE_BUILD_DONE = new RegExp([
    '\\bbuilt a complete\\b',
    '\\bi(?:[\'’]ve| have) built\\b',
    '\\bi finished\\b',
    '\\btry it in preview\\b',
    '\\bcheck preview\\b',
    '\\byou can (?:now )?(?:step through|try it)\\b',
    '\\bworking dashboard\\b',
    '\\bthe (?:flow|site|app|page) is (?:ready|live|done)\\b',
    '\\b(?:oluşturdum|inşa ettim|tamamladım)\\b',
    'preview[\'’]?da (?:dene|aç)',
].join('|'), 'i')

const DISCOVERY_PLACEHOLDER = 'Ready to open the workspace and start this build.'

/**
 * Workspace is still closed — never show a recap that pretends files landed.
 * Keeps future-tense plan sentences; drops “Built a complete… / Try Preview”.
 */
export function sanitizeDiscoveryReply(text = '') {
    const raw = String(text || '').trim()
    if (! raw) return raw

    const lines = raw.split(/\r?\n/)
    const kept = []
    let stop = false

    for (const line of lines) {
        if (stop) break
        if (FAKE_BUILD_DONE.test(line)) {
            const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean)
            const clean = []
            for (const s of sentences) {
                if (FAKE_BUILD_DONE.test(s)) {
                    stop = true
                    break
                }
                clean.push(s)
            }
            if (clean.length) {
                kept.push(clean.join(' '))
            }
            break
        }
        kept.push(line)
    }

    const next = kept.join('\n').trim()
    return next || DISCOVERY_PLACEHOLDER
}

/** Discovery chat: no code dumps, no fake “I already built this” recap. */
export function presentDiscoveryReply(text = '') {
    return sanitizeDiscoveryReply(redactDiscoveryCodeDumps(text))
}

function baseFileName(path = '') {
    const normalized = String(path || '').replace(/\\/g, '/').trim()
    if (! normalized) return ''
    return normalized.split('/').filter(Boolean).pop() || normalized
}

/**
 * Build-mode reply: scrub pseudo-tools; when writes failed, drop “all done” recaps.
 *
 * @param {string} text
 * @param {{ failedWrites?: Array<{ path?: string }> }} [options]
 */
export function sanitizeBuildReply(text = '', { failedWrites = [] } = {}) {
    let out = scrubPseudoToolTags(String(text || ''))
    const failures = (failedWrites || []).filter((row) => row?.path)
    if (! failures.length) return out

    if (FAKE_BUILD_DONE.test(out)) {
        const names = failures.map((row) => baseFileName(row.path)).filter(Boolean).join(', ')
        return names
            ? `Most of the page landed, but ${names} still needs a fix — check the write card above and ask me to retry that file.`
            : 'Most of the page landed, but one file still needs a fix — check the write card above.'
    }

    return out
}

const TOOL_NAMES = [
    'write_file',
    'read_file',
    'list_dir',
    'grep',
    'file_search',
    'lookup_visuals',
    'survey_datastore',
    'revise_datastore',
    'github_status',
    'github_compare',
    'github_push',
    'github_pull',
    'github_fork',
    'github_link',
    'github_create_repo',
    'patch_file',
    'apply_patch',
]

const TOOL_RE_PART = TOOL_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

/**
 * Strip pseudo-tool calls from visible chat text (build + discovery).
 * Strips XML tags, function calls, markdown fences, and raw JSON objects/arrays,
 * including unclosed/streaming chunks so raw tool calls never leak into chat.
 */
export function scrubPseudoToolTags(text = '') {
    let out = String(text || '')
    if (! out.trim()) return ''

    // 1. Strip XML-style pseudo-tools (both closed and unclosed/streaming)
    const xmlRe = new RegExp(`<(?:${TOOL_RE_PART})\\b[\\s\\S]*?(?:<\\/(?:${TOOL_RE_PART})>|$)`, 'giu')
    out = out.replace(xmlRe, '')

    // 2. Strip function-call style: write_file(...)
    const fnRe = new RegExp(`\\b(?:${TOOL_RE_PART})\\s*\\([\\s\\S]*?(?:\\)|$)`, 'giu')
    out = out.replace(fnRe, '')

    // 3. Strip fenced tool calls (both closed and unclosed/streaming)
    const fenceRe = new RegExp(`\`\`\`(?:json|tool[_-]?call|tools?)?\\s*\\n?[\\s\\S]*?(?:"(?:name|tool|function)"\\s*:\\s*"(?:${TOOL_RE_PART})")[\\s\\S]*?(?:\`\`\`|$)`, 'giu')
    out = out.replace(fenceRe, '')

    // 4. Strip JSON-style tool calls (both closed objects/arrays and unclosed/streaming JSON)
    const jsonToolPattern = new RegExp(`"(?:name|tool|function)"\\s*:\\s*"(?:${TOOL_RE_PART})"`, 'iu')

    let i = 0
    while (i < out.length) {
        const ch = out[i]
        if (ch === '{' || ch === '[') {
            const close = ch === '{' ? '}' : ']'
            let depth = 0
            let inString = false
            let escape = false
            let end = -1

            for (let j = i; j < out.length; j++) {
                const c = out[j]
                if (inString) {
                    if (escape) {
                        escape = false
                        continue
                    }
                    if (c === '\\') {
                        escape = true
                        continue
                    }
                    if (c === '"') inString = false
                    continue
                }
                if (c === '"') {
                    inString = true
                    continue
                }
                if (c === ch) depth += 1
                else if (c === close) {
                    depth -= 1
                    if (depth === 0) {
                        end = j
                        break
                    }
                }
            }

            if (end !== -1) {
                const candidate = out.slice(i, end + 1)
                if (jsonToolPattern.test(candidate)) {
                    out = out.slice(0, i) + out.slice(end + 1)
                    continue
                }
            } else {
                const candidate = out.slice(i)
                if (jsonToolPattern.test(candidate)) {
                    out = out.slice(0, i)
                    break
                }
            }
        }
        i += 1
    }

    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** lookup_visuals scene strings belong in the tool, not the transcript. */
export function scrubLookupVisualQueries(text = '', queries = []) {
    let out = scrubPseudoToolTags(text)
    const needles = [...new Set(
        (queries || []).map((query) => String(query || '').trim()).filter((query) => query.length >= 8),
    )]
    if (! needles.length) return out

    for (const needle of needles) {
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        out = out.replace(new RegExp(`^[\\s“"']*${escaped}[\\s”"']*(?:·\\s*\\d+)?\\s*$`, 'gim'), '')
        out = out.replace(new RegExp(`[“"']${escaped}[”"']`, 'g'), '')
    }

    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function scrubChatArtifacts(text = '') {
    const suggestions = scrubSuggestionArtifacts(text)
    const todos = scrubTodoArtifacts(suggestions.text)
    return {
        text: todos.text,
        suggestions: suggestions.suggestions,
        todos: todos.todos,
    }
}

/** Reveal `text` over time so the reply doesn’t pop in as one block. */
export function streamReveal(text, onFrame, options = {}) {
    // Meta-safe — never paints <<<KRIKKIT_META…, <suggestions>, or <todos> into chat.
    return streamRevealSafe(text, (partial) => {
        onFrame(scrubChatArtifacts(partial).text)
    }, options).then((result) => {
        const scrubbed = scrubChatArtifacts(result?.visible ?? '')
        return {
            visible: scrubbed.text,
            propose_workspace: Boolean(result?.propose_workspace),
            suggestions: scrubbed.suggestions,
        }
    })
}

export function waitUntil(predicate, { timeoutMs = 2000 } = {}) {
    return new Promise((resolve) => {
        const started = performance.now()
        const loop = createBackgroundFrameLoop()
        const tick = () => {
            if (predicate() || performance.now() - started > timeoutMs) {
                loop.cancel()
                resolve()
                return
            }
            loop.schedule(tick)
        }
        loop.schedule(tick)
    })
}
