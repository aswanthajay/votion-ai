/**
 * Detect and locally heal AI placeholder components that only render their name.
 * Keeps preview usable without another paid model turn.
 */

const STUB_INTERACTIVE = /<(Button|Input|Label|Textarea|Link|img)\b/i

/** @param {string} source */
export function componentNameFromSource(source = '') {
    const match = String(source || '').match(/\bfunction\s+([A-Z]\w*)\s*\(/)
    return match?.[1] || ''
}

/** @param {string} source */
export function isComponentNameStub(source = '') {
    const name = componentNameFromSource(source)
    if (! name) return false

    const heading = new RegExp(`<h[12]\\b[^>]*>\\s*${name}\\s*<\\/h[12]>`)
    if (! heading.test(source)) return false
    if (/\.map\s*\(/.test(source)) return false
    if (STUB_INTERACTIVE.test(source)) return false

    return String(source).length < 700
}

/** @param {Record<string, string>} contents */
export function listComponentStubPaths(contents = {}) {
    return Object.entries(contents)
        .filter(([path, body]) => /\.jsx$/i.test(path) && isComponentNameStub(body))
        .map(([path]) => path)
}

/**
 * @param {string} stubName
 * @param {Record<string, string>} contents
 */
function findDonorBody(stubName, contents) {
    const lower = stubName.toLowerCase()
    /** @type {string[]} */
    const candidates = []

    if (/cta|band|closing/.test(lower)) {
        candidates.push('src/components/CtaBand.jsx', 'src/components/ClosingCta.jsx')
    }
    if (/hero/.test(lower)) {
        candidates.push('src/components/Hero.jsx', 'src/components/ServicesHero.jsx', 'src/components/BookingHero.jsx')
    }

    for (const path of Object.keys(contents)) {
        if (/src\/components\/[A-Z]\w+\.jsx$/i.test(path)) {
            candidates.push(path)
        }
    }

    const seen = new Set()
    for (const path of candidates) {
        if (seen.has(path)) continue
        seen.add(path)
        const body = contents[path]
        if (! body || isComponentNameStub(body)) continue
        if (body.length > 400) return { path, body }
    }

    return null
}

/**
 * @param {string} stubName
 * @param {string} donorBody
 * @param {string} donorName
 */
function cloneDonorForStub(stubName, donorBody, donorName) {
    let next = donorBody
    if (donorName) {
        next = next.replace(new RegExp(`\\bfunction\\s+${donorName}\\b`, 'g'), `function ${stubName}`)
        next = next.replace(new RegExp(`export\\s+default\\s+${donorName}\\b`, 'g'), `export default ${stubName}`)
        next = next.replace(new RegExp(`export\\s+{\\s*${donorName}\\s*}`, 'g'), `export { ${stubName} }`)
    }
    return next
}

/** @param {string} name */
function generateContextualStub(name) {
    const lower = String(name || '').toLowerCase()

    if (/header|navbar|topbar|nav\b/i.test(lower)) {
        return `import React from 'react'

export function ${name}({ onOpenCart, onOpenReserve, cartCount = 0, ...props }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 bg-white/95 backdrop-blur shadow-xs" {...props}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-amber-900">Savoria</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Bistro</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <a href="#home" className="hover:text-amber-700 transition-colors">Home</a>
          <a href="#menu" className="hover:text-amber-700 transition-colors">Menu</a>
          <a href="#about" className="hover:text-amber-700 transition-colors">About</a>
          <a href="#contact" className="hover:text-amber-700 transition-colors">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenReserve}
            className="rounded-full bg-amber-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors cursor-pointer"
          >
            Reserve Table
          </button>
          <button
            type="button"
            onClick={onOpenCart}
            className="relative rounded-full border border-stone-300 p-2 text-stone-700 hover:border-amber-600 hover:text-amber-700 transition-colors cursor-pointer"
            aria-label="View Cart"
          >
            🛒
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

export default ${name}
`
    }

    if (/footer/i.test(lower)) {
        return `import React from 'react'

export function ${name}(props) {
  return (
    <footer className="border-t border-stone-200 bg-stone-900 text-stone-300 py-12 px-4 sm:px-6 lg:px-8" {...props}>
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Savoria Bistro</h3>
          <p className="mt-3 text-sm text-stone-400">
            Artisanal dining celebrating seasonal, farm-to-table cuisine and warm hospitality.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Hours</h4>
          <p className="mt-2 text-sm text-stone-400">Mon - Thu: 11:30 AM - 10:00 PM</p>
          <p className="text-sm text-stone-400">Fri - Sat: 11:30 AM - 11:00 PM</p>
          <p className="text-sm text-stone-400">Sunday: 10:00 AM - 9:00 PM</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Location</h4>
          <p className="mt-2 text-sm text-stone-400">428 Culinary Way, Downtown</p>
          <p className="text-sm text-stone-400">Reservations: (555) 234-5678</p>
          <p className="text-sm text-stone-400">info@savoriabistro.com</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Newsletter</h4>
          <p className="mt-2 text-sm text-stone-400">Get secret chef specials & tasting events.</p>
          <div className="mt-3 flex gap-2">
            <input
              type="email"
              placeholder="Your email"
              className="w-full rounded-md bg-stone-800 border border-stone-700 px-3 py-1.5 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
            <button className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors">
              Join
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl mt-8 pt-8 border-t border-stone-800 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} Savoria Bistro. All rights reserved.
      </div>
    </footer>
  )
}

export default ${name}
`
    }

    if (/hero|home|banner/i.test(lower)) {
        return `import React from 'react'

export function ${name}({ onExploreMenu, onOpenReserve, ...props }) {
  return (
    <section id="home" className="relative overflow-hidden bg-stone-900 text-white py-20 lg:py-28" {...props}>
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top_right,var(--color-amber-500),transparent_50%)]" />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 text-center">
        <span className="inline-block rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold tracking-wider text-amber-300 uppercase mb-4">
          ★ Michelin Guide Recommended 2025
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
          Handcrafted Dishes. <br className="hidden sm:inline" />
          <span className="text-amber-400">Unforgettable Moments.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-stone-300">
          Experience seasonal farm-to-table flavors, freshly rolled pasta, and signature crafted cocktails in a cozy, welcoming atmosphere.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href="#menu"
            onClick={onExploreMenu}
            className="rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-amber-700 transition-colors"
          >
            Explore Full Menu
          </a>
          <button
            type="button"
            onClick={onOpenReserve}
            className="rounded-full border border-stone-500 bg-white/10 backdrop-blur px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            Reserve a Table
          </button>
        </div>
      </div>
    </section>
  )
}

export default ${name}
`
    }

    if (/menu|dish|food|catalog|product|item|service/i.test(lower)) {
        return `import React from 'react'

export function ${name}({ onAddToCart, ...props }) {
  const sampleDishes = [
    { id: '1', name: 'Truffle Wild Mushroom Risotto', category: 'Mains', price: 28, desc: 'Creamy arborio rice, foraged forest mushrooms, black truffle shavings, aged parmesan.', tag: 'Vegetarian' },
    { id: '2', name: 'Pan-Seared Chilean Sea Bass', category: 'Mains', price: 38, desc: 'Saffron emulsion, crispy leeks, baby zucchini, heirloom tomato confit.', tag: 'Gluten-Free' },
    { id: '3', name: 'Artisan Burrata Caprese', category: 'Starters', price: 19, desc: 'Imported Puglia burrata, balsamic reduction, basil oil, grilled sourdough.', tag: 'Chef Special' },
  ]

  return (
    <section id="menu" className="py-16 px-4 sm:px-6 lg:px-8 bg-stone-50" {...props}>
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Seasonal Selection</span>
          <h2 className="text-3xl font-extrabold text-stone-900 sm:text-4xl mt-1">Our Featured Menu</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {sampleDishes.map((dish) => (
            <div key={dish.id} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-lg font-bold text-stone-900">{dish.name}</h3>
                  <span className="text-lg font-extrabold text-amber-700">\${dish.price}</span>
                </div>
                <span className="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                  {dish.tag}
                </span>
                <p className="mt-3 text-sm text-stone-600 leading-relaxed">{dish.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => onAddToCart && onAddToCart(dish)}
                className="mt-6 w-full rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors cursor-pointer"
              >
                Add to Order
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ${name}
`
    }

    return `import React from 'react'

export function ${name}(props) {
  return (
    <section className="relative overflow-hidden py-16 lg:py-24 bg-stone-50 border-b border-stone-200" {...props}>
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          ${name}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-stone-600">
          Experience authentic flavors, handcrafted culinary artistry, and exceptional hospitality.
        </p>
        <div className="mt-8">
          <a
            href="#menu"
            className="inline-flex items-center justify-center rounded-full bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors"
          >
            Explore Options
          </a>
        </div>
      </div>
    </section>
  )
}

export default ${name}
`
}

/**
 * @param {Record<string, string>} contents
 * @returns {{ patch: Record<string, string>, healed: string[] }}
 */
export function healComponentStubs(contents = {}) {
    /** @type {Record<string, string>} */
    const patch = {}
    /** @type {string[]} */
    const healed = []

    for (const [path, body] of Object.entries(contents)) {
        if (! /\.jsx$/i.test(path) || ! isComponentNameStub(body)) continue

        const stubName = componentNameFromSource(body)
        const donor = findDonorBody(stubName, contents)
        const donorName = donor ? componentNameFromSource(donor.body) : ''
        const next = donor
            ? cloneDonorForStub(stubName, donor.body, donorName)
            : generateContextualStub(stubName)

        patch[path] = next
        healed.push(path)
    }

    return { patch, healed }
}

/**
 * @param {Record<string, string>} contents
 * @returns {Record<string, string>}
 */
export function applyComponentStubHeal(contents = {}) {
    const { patch } = healComponentStubs(contents)
    if (! Object.keys(patch).length) return contents
    return { ...contents, ...patch }
}
