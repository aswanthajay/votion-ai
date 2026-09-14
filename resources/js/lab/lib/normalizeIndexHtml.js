export const CANONICAL_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lab Site</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`

/**
 * Checks whether index.html retains the required React SPA mount and entry script.
 *
 * @param {string} body
 * @returns {boolean}
 */
export function isIndexHtmlValid(body) {
    if (! body || typeof body !== 'string') return false
    const text = String(body)
    const hasRoot = /id=["']root["']/.test(text)
    const hasMain = /src=["'][^"']*(?:\/|\b)src\/main\.[jt]sx?["']/.test(text)
    return hasRoot && hasMain
}

/**
 * Auto-heals index.html if it has been stripped of #root or main.jsx script.
 * Preserves custom <title> and other elements in <head> if present.
 *
 * @param {string|null|undefined} rawBody
 * @returns {string}
 */
export function normalizeLabIndexHtml(rawBody) {
    if (! rawBody || typeof rawBody !== 'string' || ! rawBody.trim()) {
        return CANONICAL_INDEX_HTML
    }

    if (isIndexHtmlValid(rawBody)) {
        return rawBody
    }

    // Attempt to extract title if present
    const titleMatch = rawBody.match(/<title>([^<]*)<\/title>/i)
    const title = titleMatch && titleMatch[1].trim() ? titleMatch[1].trim() : 'Lab Site'

    // Attempt to extract head contents
    const headMatch = rawBody.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
    const headInner = headMatch ? headMatch[1].trim() : ''

    // Ensure charset and viewport
    let headContent = ''
    if (headInner) {
        if (! /charset=/i.test(headInner)) {
            headContent += '    <meta charset="UTF-8" />\n'
        }
        if (! /name=["']viewport["']/i.test(headInner)) {
            headContent += '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
        }
        if (! /<title>/i.test(headInner)) {
            headContent += `    <title>${title}</title>\n`
        }
        headContent += `    ${headInner.split('\n').map((l) => l.trim()).filter(Boolean).join('\n    ')}`
    } else {
        headContent = `    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${title}</title>`
    }

    return `<!doctype html>
<html lang="en">
  <head>
${headContent}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`
}
