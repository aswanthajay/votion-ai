import { healSourceSyntax, probeSourceSyntax } from '../orchestration/syntaxProbe.js'

/**
 * Sanitizes and heals common hallucinations produced by small local models (e.g. Qwen 2.5 Coder 1.5B).
 * Converts Next.js router, Chakra UI components, missing hooks, and non-existent packages into valid standard React + Tailwind CSS.
 *
 * @param {string} code
 * @param {string} [path]
 * @returns {string}
 */
export function sanitizeWebLlmGeneratedCode(code = '', path = '') {
    if (! code || typeof code !== 'string') return code
    if (path && ! /\.(jsx?|tsx?)$/i.test(path)) return code

    let out = code

    // 1. Fix malformed / hallucinated package imports
    out = out.replace(/from\s+['"]@lucide-react\/icons['"]/g, "from 'lucide-react'")
    out = out.replace(/from\s+['"]lucide-react\/icons['"]/g, "from 'lucide-react'")

    // If lucide-react import exists or Lucide icons are used, ensure LucideIcons namespace is available
    const usesLucideNamespace = /\b[Ll]ucideReact\b/.test(out)
    if (usesLucideNamespace && ! /import\s+\*\s+as\s+LucideIcons\s+from\s+['"]lucide-react['"]/.test(out)) {
        if (/from\s+['"]lucide-react['"]/.test(out)) {
            out = out.replace(/import\s+({[^}]*}|\w+)\s+from\s+['"]lucide-react['"];?/, (match) => {
                return `import * as LucideIcons from 'lucide-react';\n${match}`
            })
        } else {
            out = `import * as LucideIcons from 'lucide-react';\n` + out
        }
    }

    // Strip uninstalled framework/library imports
    out = out.replace(/import\s+(?:{[^}]*}|\w+)\s+from\s+['"](?:next\/router|next\/navigation|next\/link)['"];?/g, '')
    out = out.replace(/import\s+(?:{[^}]*}|\w+)\s+from\s+['"]@chakra-ui\/react['"];?/g, '')
    out = out.replace(/import\s+(?:{[^}]*}|\w+)\s+from\s+['"]@tanstack\/react-query['"];?/g, '')
    out = out.replace(/import\s+(?:{[^}]*}|\w+)\s+from\s+['"]react-use['"];?/g, '')
    out = out.replace(/import\s+(?:{[^}]*}|\w+)\s+from\s+['"]@mui\/[a-zA-Z0-9_-]+['"];?/g, '')
    out = out.replace(/import\s+(?:\*\s+as\s+\w+|{[^}]*}|\w+)\s+from\s+['"](?:yup|zod|react-hook-form|@hookform\/[a-zA-Z0-9_/-]+|react-hot-toast|react-toastify|sonner|axios|framer-motion)['"];?/g, '')
    out = out.replace(/import\s+(?:\*\s+as\s+\w+|{[^}]*}|\w+)\s+from\s+['"](?:leaflet|react-leaflet|mapbox-gl|pigeon-maps)['"];?/g, '')
    out = out.replace(/import\s+['"][^'"]*(?:leaflet|mapbox)[^'"]*['"];?/g, '')

    // Strip hallucinated relative local imports (e.g. import { mapChrome } from './mapChrome')
    out = out.replace(/^import\s+(?:(\*\s+as\s+\w+)|({[^}]*})|(\w+))\s+from\s+['"]\.\/(?:mapChrome|data|mockData|mock|places|constants|types|utils|api|helpers)['"].*$/gm, (match, star, named, def) => {
        const decls = []
        if (star) {
            const name = star.replace(/\*\s+as\s+/, '').trim()
            decls.push(`const ${name} = {};`)
        }
        if (def) {
            decls.push(`const ${def} = {};`)
        }
        if (named) {
            const idents = named.replace(/[{}]/g, '').split(',').map((s) => s.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean)
            idents.forEach((id) => decls.push(`const ${id} = {};`))
        }
        return decls.join('\n')
    })

    // Remove lucideReact named import
    out = out.replace(/import\s+{\s*lucideReact\s*}\s+from\s+['"]lucide-react['"];?/g, '')

    // Ensure React is imported
    if (! /import\s+React\b/.test(out)) {
        if (/import\s+({[^}]*})\s+from\s+['"]react['"]/.test(out)) {
            out = out.replace(/import\s+({[^}]*})\s+from\s+['"]react['"]/, "import React, $1 from 'react'")
        } else {
            out = "import React, { useState, useEffect } from 'react';\n" + out
        }
    }

    // 2. Inject helper components and hook stubs
    const stubs = []

    if (usesLucideNamespace && ! /const\s+LucideReact\s*=/.test(out)) {
        stubs.push(`const LucideReact = typeof LucideIcons !== 'undefined'
  ? new Proxy(LucideIcons, {
      get: (target, prop) => target[prop] || target[prop.toLowerCase()] || (() => <span className="inline-block text-base">✦</span>)
    })
  : new Proxy({}, { get: () => () => <span className="inline-block text-base">✦</span> });
const lucideReact = LucideReact;`)
    }

    if (/\buseRouter\s*\(/.test(out) && ! /const\s+useRouter\s*=/.test(out) && ! /function\s+useRouter\b/.test(out)) {
        stubs.push(`const useRouter = () => ({ push: () => {}, replace: () => {}, back: () => {}, pathname: '/', query: {} });`)
    }

    if (/\byup\b/.test(out) && ! /const\s+yup\s*=/.test(out)) {
        stubs.push(`const yup = {
  object: (shape = {}) => ({
    shape,
    validate: async (data) => data,
    validateSync: (data) => data,
    cast: (data) => data,
    required: () => yup.object(shape),
  }),
  string: () => {
    const c = { required: () => c, email: () => c, min: () => c, max: () => c, matches: () => c };
    return c;
  },
  number: () => {
    const c = { required: () => c, positive: () => c, integer: () => c, min: () => c, max: () => c };
    return c;
  },
  boolean: () => ({ required: () => ({}) }),
  array: () => ({ required: () => ({}), min: () => ({}) }),
};`)
    }

    if (/\bz\s*\.\s*(?:object|string|number)\b/.test(out) && ! /const\s+z\s*=/.test(out)) {
        stubs.push(`const z = {
  object: (shape = {}) => ({
    shape,
    parse: (data) => data,
    safeParse: (data) => ({ success: true, data }),
  }),
  string: () => {
    const c = { min: () => c, max: () => c, email: () => c, optional: () => c, regex: () => c };
    return c;
  },
  number: () => {
    const c = { min: () => c, max: () => c, positive: () => c, optional: () => c };
    return c;
  },
  boolean: () => ({ optional: () => ({}) }),
  array: () => ({ min: () => ({}) }),
};`)
    }

    if ((/\buseForm\s*\(/.test(out) || /\byupResolver\b/.test(out) || /\bzodResolver\b/.test(out)) && ! /function\s+useForm\b/.test(out) && ! /const\s+useForm\s*=/.test(out)) {
        stubs.push(`function useForm(opts = {}) {
  const [values, setValues] = React.useState({});
  const [errors, setErrors] = React.useState({});
  const register = (name) => ({
    name,
    onChange: (e) => {
      const val = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
      setValues((prev) => ({ ...prev, [name]: val }));
    },
    value: values[name] ?? '',
  });
  const handleSubmit = (onValid) => (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof onValid === 'function') onValid(values);
  };
  const watch = (name) => (name ? values[name] : values);
  const setValue = (name, val) => setValues((prev) => ({ ...prev, [name]: val }));
  const getValues = (name) => (name ? values[name] : values);
  const reset = (newVals = {}) => setValues(newVals);
  return { register, handleSubmit, watch, setValue, getValues, reset, formState: { errors, isValid: true } };
}
const yupResolver = () => () => ({ values: {}, errors: {} });
const zodResolver = () => () => ({ values: {}, errors: {} });
const Controller = ({ render }) => typeof render === 'function' ? render({ field: { onChange: () => {}, value: '' } }) : null;`)
    }

    if (/\buseLocalStorage\s*\(/.test(out) && ! /function\s+useLocalStorage\b/.test(out) && ! /const\s+useLocalStorage\s*=/.test(out)) {
        stubs.push(`function useLocalStorage(key, initialValue) {
  const [val, setVal] = React.useState(() => {
    try {
      const item = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(val) : value;
      setVal(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch {}
  };
  return [val, setValue];
}`)
    }

    if (/\buseQuery\s*\(/.test(out) && ! /function\s+useQuery\b/.test(out) && ! /const\s+useQuery\s*=/.test(out)) {
        stubs.push(`const SAMPLE_FALLBACK_DATA = [
  { id: 1, title: 'Creamy Tuscan Garlic Chicken', servings: 4, cookTime: 30, category: 'dinner', ingredients: ['Chicken Breast', 'Garlic', 'Heavy Cream', 'Sun-dried Tomatoes', 'Spinach', 'Parmesan'], steps: ['Sear seasoned chicken breasts until golden.', 'Sauté minced garlic and sun-dried tomatoes.', 'Add cream and simmer, stir in spinach.', 'Return chicken and coat in creamy sauce.'] },
  { id: 2, title: 'Avocado & Poached Egg Toast', servings: 2, cookTime: 15, category: 'breakfast', ingredients: ['Sourdough Bread', 'Ripe Avocados', 'Fresh Eggs', 'Red Chili Flakes', 'Lemon Juice'], steps: ['Toast sourdough until crispy.', 'Mash avocado with lemon juice, salt and pepper.', 'Poach eggs in simmering water for 3 mins.', 'Assemble toast with eggs and chili flakes.'] },
  { id: 3, title: 'Mediterranean Quinoa Power Bowl', servings: 2, cookTime: 20, category: 'lunch', ingredients: ['Quinoa', 'Cucumber', 'Cherry Tomatoes', 'Kalamata Olives', 'Feta Cheese', 'Olive Oil'], steps: ['Cook quinoa and let cool slightly.', 'Dice fresh vegetables.', 'Toss together with olive oil and oregano.', 'Top with crumbled feta cheese.'] },
  { id: 4, title: 'Classic Belgian Berry Waffles', servings: 3, cookTime: 25, category: 'breakfast', ingredients: ['Flour', 'Milk', 'Eggs', 'Baking Powder', 'Butter', 'Fresh Berries', 'Maple Syrup'], steps: ['Whisk dry ingredients with beaten eggs and milk.', 'Pour batter into heated waffle iron until golden.', 'Serve warm topped with berries and syrup.'] }
];

function useQuery({ queryFn }) {
  const [data, setData] = React.useState(SAMPLE_FALLBACK_DATA);
  const [isLoading, setIsLoading] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    if (typeof queryFn === 'function') {
      setIsLoading(true);
      Promise.resolve(queryFn())
        .then((res) => {
          if (active && res && (Array.isArray(res) ? res.length > 0 : true)) {
            setData(res);
          }
        })
        .catch(() => {})
        .finally(() => { if (active) setIsLoading(false); });
    }
    return () => { active = false; };
  }, []);
  return { data, isLoading };
}`)
    }

    // Chakra UI components compatibility helpers
    if (/<Box\b/.test(out) && ! /const\s+Box\s*=/.test(out)) {
        stubs.push(`const Box = ({ children, className = '', minH, bg, text, p, ...props }) => {
  let cls = className;
  if (minH === '100vh') cls += ' min-h-screen';
  if (bg === 'neutral.900') cls += ' bg-neutral-900';
  if (text === 'white') cls += ' text-white';
  if (p) cls += \` p-\${p}\`;
  return <div className={cls.trim()} {...props}>{children}</div>;
};`)
    }

    if (/<Flex\b/.test(out) && ! /const\s+Flex\s*=/.test(out)) {
        stubs.push(`const Flex = ({ children, className = '', justify, align, direction, gap, mb, ...props }) => {
  let cls = 'flex ' + className;
  if (justify === 'space-between') cls += ' justify-between';
  else if (justify === 'center') cls += ' justify-center';
  else if (justify === 'flex-end') cls += ' justify-end';
  if (align === 'center') cls += ' items-center';
  if (direction === 'column') cls += ' flex-col';
  else if (direction === 'row') cls += ' flex-row';
  if (gap) cls += \` gap-\${gap}\`;
  if (mb) cls += \` mb-\${mb}\`;
  return <div className={cls.trim()} {...props}>{children}</div>;
};`)
    }

    if (/<Heading\b/.test(out) && ! /const\s+Heading\s*=/.test(out)) {
        stubs.push(`const Heading = ({ children, size, className = '', ...props }) => {
  let cls = 'font-bold ' + className;
  if (size === '2xl' || size === '3xl') cls += ' text-3xl';
  else if (size === 'xl' || size === 'lg') cls += ' text-2xl';
  else cls += ' text-xl';
  return <h2 className={cls.trim()} {...props}>{children}</h2>;
};`)
    }

    if (/<Text\b/.test(out) && ! /const\s+Text\s*=/.test(out)) {
        stubs.push(`const Text = ({ children, className = '', ...props }) => <p className={className} {...props}>{children}</p>;`)
    }

    if (/<Card\b/.test(out) && ! /const\s+Card\s*=/.test(out)) {
        stubs.push(`const Card = ({ children, className = '', p, borderWidth, borderColor, ...props }) => (
  <div className={\`rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden \${p ? \`p-\${p}\` : 'p-4'} \${className}\`.trim()} {...props}>
    {children}
  </div>
);
const CardHeader = ({ children, className = '', ...props }) => <div className={\`pb-3 border-b border-neutral-800/80 \${className}\`.trim()} {...props}>{children}</div>;
const CardBody = ({ children, className = '', ...props }) => <div className={\`py-4 \${className}\`.trim()} {...props}>{children}</div>;
const CardFooter = ({ children, className = '', ...props }) => <div className={\`pt-3 border-t border-neutral-800/80 \${className}\`.trim()} {...props}>{children}</div>;`)
    }

    if (/<Skeleton\b/.test(out) && ! /const\s+Skeleton\s*=/.test(out)) {
        stubs.push(`const Skeleton = ({ className = '', height, width, ...props }) => (
  <div className={\`animate-pulse bg-neutral-800 rounded-xl \${className}\`.trim()} style={{ height: height || '8rem', width: width || '100%' }} {...props} />
);`)
    }

    if (/<Button\b/.test(out) && ! /const\s+Button\s*=/.test(out)) {
        stubs.push(`const Button = ({ children, variant, colorScheme, className = '', ...props }) => {
  let cls = 'px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 cursor-pointer ';
  if (colorScheme === 'primary' || colorScheme === 'blue') cls += 'bg-amber-600 hover:bg-amber-500 text-white ';
  else if (colorScheme === 'red') cls += 'bg-red-600/80 hover:bg-red-600 text-white ';
  else if (colorScheme === 'green') cls += 'bg-emerald-600/80 hover:bg-emerald-600 text-white ';
  else if (variant === 'outline') cls += 'border border-neutral-700 hover:bg-neutral-800 text-neutral-200 ';
  else cls += 'bg-neutral-800 hover:bg-neutral-700 text-white ';
  return <button className={(cls + className).trim()} {...props}>{children}</button>;
};`)
    }

    if (/<Input\b/.test(out) && ! /const\s+Input\s*=/.test(out)) {
        stubs.push(`const Input = ({ className = '', ...props }) => (
  <input className={\`px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full \${className}\`.trim()} {...props} />
);`)
    }

    if (/\btoast\b/.test(out) && ! /const\s+toast\s*=/.test(out)) {
        stubs.push(`const toast = { success: (m) => console.log(m), error: (m) => console.error(m), loading: () => {}, dismiss: () => {}, custom: () => {} };`)
    }

    if (/\baxios\b/.test(out) && ! /const\s+axios\s*=/.test(out)) {
        stubs.push(`const axios = { get: async () => ({ data: {} }), post: async (url, data) => ({ data }) };`)
    }

    if (/\bmotion\b/.test(out) && ! /const\s+motion\s*=/.test(out)) {
        stubs.push(`const motion = new Proxy({}, {
  get: (target, tag) => {
    return React.forwardRef(({ children, whileHover, whileTap, initial, animate, exit, transition, ...props }, ref) => {
      const Component = typeof tag === 'string' && tag.length ? tag : 'div';
      return React.createElement(Component, { ref, ...props }, children);
    });
  }
});
const AnimatePresence = ({ children }) => <>{children}</>;`)
    }

    if ((/\bMapContainer\b/.test(out) || /\bMarker\b/.test(out) || /\bTileLayer\b/.test(out) || /\bPopup\b/.test(out) || /\bL\s*\./.test(out)) && ! /const\s+MapContainer\s*=/.test(out)) {
        stubs.push(`const MapContainer = ({ children, className = '', style, center, zoom }) => (
  <div className={\`relative overflow-hidden rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center min-h-[360px] \${className}\`.trim()} style={style || { width: '100%', height: '400px' }}>
    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 text-xs text-neutral-300">
      <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
      <span className="font-medium">Map Preview</span>
    </div>
    <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 p-6">
      {children}
    </div>
  </div>
);
const TileLayer = () => null;
const Marker = ({ position, children, onClick }) => (
  <button type="button" onClick={onClick} className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/90 hover:bg-sky-400 text-white text-xs font-semibold rounded-full shadow-lg shadow-sky-500/30 transition hover:scale-105 active:scale-95">
    <span>📍</span>
    <span>{children}</span>
  </button>
);
const Popup = ({ children }) => <div className="text-xs text-neutral-200 mt-1">{children}</div>;
const L = { Icon: function() { return {}; } };`)
    }

    if (stubs.length > 0) {
        // Insert stubs right after import statements so top-level constants have dependencies available before initialization
        const lines = out.split('\n')
        let lastImportLineIdx = -1
        let inImport = false
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (/^import\b/.test(line)) {
                lastImportLineIdx = i
                if (!line.includes('from') && !line.endsWith(';') && !line.endsWith("'") && !line.endsWith('"')) {
                    inImport = true
                }
            } else if (inImport) {
                lastImportLineIdx = i
                if (line.includes('from') || line.endsWith(';') || line.endsWith("'") || line.endsWith('"')) {
                    inImport = false
                }
            }
        }

        if (lastImportLineIdx >= 0) {
            lines.splice(lastImportLineIdx + 1, 0, '\n' + stubs.join('\n\n'))
            out = lines.join('\n')
        } else {
            const funcMatch = out.match(/(?:export\s+default\s+function|function\s+App|const\s+App\s*=)/)
            if (funcMatch && funcMatch.index !== undefined) {
                const idx = funcMatch.index
                out = out.slice(0, idx) + stubs.join('\n\n') + '\n\n' + out.slice(idx)
            } else {
                out = stubs.join('\n\n') + '\n\n' + out
            }
        }
    }

    if (/\.(jsx?|tsx?)$/i.test(path) && probeSourceSyntax(path, out).length > 0) {
        const healed = healSourceSyntax(path, out)
        if (healed.healed) {
            out = healed.body
        }
    }

    return out
}
