const EXT_META = {
    php: { label: 'PHP', tone: 'violet' },
    js: { label: 'JS', tone: 'amber' },
    jsx: { label: 'JSX', tone: 'amber' },
    mjs: { label: 'JS', tone: 'amber' },
    cjs: { label: 'JS', tone: 'amber' },
    ts: { label: 'TS', tone: 'sky' },
    tsx: { label: 'TSX', tone: 'sky' },
    css: { label: 'CSS', tone: 'sky' },
    scss: { label: 'SCSS', tone: 'rose' },
    html: { label: 'HTML', tone: 'orange' },
    json: { label: 'JSON', tone: 'lime' },
    md: { label: 'MD', tone: 'slate' },
    txt: { label: 'TXT', tone: 'slate' },
    pdf: { label: 'PDF', tone: 'red' },
    csv: { label: 'CSV', tone: 'green' },
    xml: { label: 'XML', tone: 'orange' },
    yml: { label: 'YML', tone: 'slate' },
    yaml: { label: 'YAML', tone: 'slate' },
    vue: { label: 'VUE', tone: 'green' },
    py: { label: 'PY', tone: 'sky' },
    rb: { label: 'RB', tone: 'rose' },
    go: { label: 'GO', tone: 'cyan' },
    rs: { label: 'RS', tone: 'orange' },
    java: { label: 'JAVA', tone: 'orange' },
    zip: { label: 'ZIP', tone: 'slate' },
    svg: { label: 'SVG', tone: 'lime' },
    sql: { label: 'SQL', tone: 'sky' },
    sh: { label: 'SH', tone: 'slate' },
    bash: { label: 'BASH', tone: 'slate' },
    zsh: { label: 'ZSH', tone: 'slate' },
    bat: { label: 'BAT', tone: 'slate' },
    env: { label: 'ENV', tone: 'amber' },
    c: { label: 'C', tone: 'sky' },
    cpp: { label: 'CPP', tone: 'sky' },
    cs: { label: 'C#', tone: 'violet' },
    swift: { label: 'SWIFT', tone: 'orange' },
    kt: { label: 'KT', tone: 'violet' },
    svelte: { label: 'SVELTE', tone: 'orange' },
    toml: { label: 'TOML', tone: 'slate' },
    ini: { label: 'INI', tone: 'slate' },
    dockerfile: { label: 'DOCKER', tone: 'sky' },
    makefile: { label: 'MAKE', tone: 'slate' },
}

const TONE_CLASSES = {
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    sky: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
    lime: 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300',
    slate: 'bg-krikkit-soft text-krikkit-fg-soft',
    red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
}

export const TEXT_CODE_EXTENSIONS = new Set([
    'txt', 'text', 'log', 'env',
    'py', 'pyw',
    'js', 'jsx', 'mjs', 'cjs',
    'ts', 'tsx', 'mts', 'cts',
    'html', 'htm', 'xhtml',
    'css', 'scss', 'sass', 'less',
    'json', 'jsonc', 'json5',
    'csv', 'tsv',
    'md', 'markdown', 'mdx',
    'xml', 'svg',
    'yml', 'yaml', 'toml', 'ini', 'conf', 'config',
    'php', 'phtml',
    'rb', 'erb',
    'go', 'rs', 'java', 'kt', 'kts', 'scala',
    'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hh', 'cs', 'swift',
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
    'sql', 'graphql', 'gql',
    'vue', 'svelte', 'astro',
    'dockerfile', 'makefile', 'prisma', 'proto',
])

export function getExtension(name = '') {
    const parts = name.split('.')
    return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

export function isImageAttachment(attachment) {
    if (attachment?.kind === 'image') {
        return true
    }

    if (attachment?.type?.startsWith('image/')) {
        return true
    }

    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'].includes(getExtension(attachment?.name))
}

export function isTextCodeAttachment(attachment) {
    if (! attachment) return false
    const name = attachment.name || ''
    const ext = getExtension(name)
    if (TEXT_CODE_EXTENSIONS.has(ext)) return true

    const type = String(attachment.type || '').toLowerCase()
    if (type.startsWith('text/')) return true
    if (type.includes('json') || type.includes('javascript') || type.includes('xml') || type.includes('yaml')) return true

    const base = name.split('/').pop()?.split('\\').pop()?.toLowerCase() || ''
    if (['dockerfile', 'makefile', 'license', 'gemfile', 'procfile', '.env', '.gitignore'].includes(base)) return true

    return false
}

export function getLanguageIdentifier(ext = '') {
    const e = String(ext || '').toLowerCase().replace(/^\./, '')
    const map = {
        py: 'python',
        pyw: 'python',
        js: 'javascript',
        mjs: 'javascript',
        cjs: 'javascript',
        jsx: 'jsx',
        ts: 'typescript',
        mts: 'typescript',
        cts: 'typescript',
        tsx: 'tsx',
        html: 'html',
        htm: 'html',
        css: 'css',
        scss: 'scss',
        sass: 'sass',
        less: 'less',
        json: 'json',
        jsonc: 'json',
        csv: 'csv',
        tsv: 'tsv',
        md: 'markdown',
        markdown: 'markdown',
        mdx: 'markdown',
        xml: 'xml',
        svg: 'xml',
        yml: 'yaml',
        yaml: 'yaml',
        toml: 'toml',
        ini: 'ini',
        env: 'bash',
        php: 'php',
        rb: 'ruby',
        go: 'go',
        rs: 'rust',
        java: 'java',
        kt: 'kotlin',
        kts: 'kotlin',
        scala: 'scala',
        c: 'c',
        h: 'c',
        cpp: 'cpp',
        hpp: 'cpp',
        cc: 'cpp',
        cs: 'csharp',
        swift: 'swift',
        sh: 'bash',
        bash: 'bash',
        zsh: 'bash',
        bat: 'bat',
        cmd: 'bat',
        ps1: 'powershell',
        sql: 'sql',
        vue: 'vue',
        svelte: 'svelte',
        dockerfile: 'dockerfile',
        makefile: 'makefile',
        txt: 'text',
        log: 'text',
    }
    return map[e] || e || 'text'
}

export const MAX_ATTACHMENT_CHARS = 50000

export async function readAttachmentText(file) {
    if (! file || typeof file.slice !== 'function') return null
    try {
        const slice = file.slice(0, 65536)
        let text = await slice.text()
        if (file.size > 65536 || text.length > MAX_ATTACHMENT_CHARS) {
            text = text.slice(0, MAX_ATTACHMENT_CHARS) + `\n\n... [Content truncated: ${file.name} is ${formatBytes(file.size)}. Showing first ${MAX_ATTACHMENT_CHARS.toLocaleString()} characters] ...`
        }
        return text
    } catch (err) {
        console.warn('[attachments] Failed to read attachment text:', err)
        return null
    }
}

export async function loadAttachmentContent(attachment) {
    if (! attachment) return attachment
    if (typeof attachment.content === 'string') return attachment
    if (! isTextCodeAttachment(attachment)) return attachment

    if (attachment.file) {
        const text = await readAttachmentText(attachment.file)
        if (text !== null) {
            attachment.content = text
        }
    }
    return attachment
}

export function getFileMeta(attachment) {
    const ext = getExtension(attachment?.name)
    const meta = EXT_META[ext]

    if (meta) {
        return {
            ext,
            label: meta.label,
            toneClass: TONE_CLASSES[meta.tone] || TONE_CLASSES.slate,
        }
    }

    return {
        ext: ext || 'file',
        label: (ext || 'FILE').toUpperCase().slice(0, 5),
        toneClass: TONE_CLASSES.slate,
    }
}

export function formatBytes(bytes = 0) {
    if (bytes < 1024) {
        return `${bytes} B`
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function createAttachmentFromFile(file) {
    const isImage = isImageAttachment({ name: file.name, type: file.type })
    const isText = ! isImage && isTextCodeAttachment({ name: file.name, type: file.type })
    const kind = isImage ? 'image' : (isText ? 'code' : 'file')

    const attachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        kind,
        url: URL.createObjectURL(file),
        file,
        content: null,
        ...getFileMeta({ name: file.name }),
    }

    if (isText && typeof file.slice === 'function') {
        readAttachmentText(file).then((text) => {
            if (text !== null) {
                attachment.content = text
            }
        }).catch(() => {})
    }

    return attachment
}
