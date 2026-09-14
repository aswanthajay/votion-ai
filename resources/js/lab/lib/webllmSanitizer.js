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

    if (/\buseRouter\s*\(/.test(out) && ! /const\s+useRouter\s*=/.test(out)) {
        stubs.push(`const useRouter = () => ({ push: () => {}, replace: () => {}, back: () => {}, pathname: '/', query: {} });`)
    }

    if (/\buseLocalStorage\s*\(/.test(out) && ! /const\s+useLocalStorage\s*=/.test(out)) {
        stubs.push(`const useLocalStorage = (key, initialValue) => {
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
};`)
    }

    if (/\buseQuery\s*\(/.test(out) && ! /const\s+useQuery\s*=/.test(out)) {
        stubs.push(`const SAMPLE_FALLBACK_DATA = [
  { id: 1, title: 'Creamy Tuscan Garlic Chicken', servings: 4, cookTime: 30, category: 'dinner', ingredients: ['Chicken Breast', 'Garlic', 'Heavy Cream', 'Sun-dried Tomatoes', 'Spinach', 'Parmesan'], steps: ['Sear seasoned chicken breasts until golden.', 'Sauté minced garlic and sun-dried tomatoes.', 'Add cream and simmer, stir in spinach.', 'Return chicken and coat in creamy sauce.'] },
  { id: 2, title: 'Avocado & Poached Egg Toast', servings: 2, cookTime: 15, category: 'breakfast', ingredients: ['Sourdough Bread', 'Ripe Avocados', 'Fresh Eggs', 'Red Chili Flakes', 'Lemon Juice'], steps: ['Toast sourdough until crispy.', 'Mash avocado with lemon juice, salt and pepper.', 'Poach eggs in simmering water for 3 mins.', 'Assemble toast with eggs and chili flakes.'] },
  { id: 3, title: 'Mediterranean Quinoa Power Bowl', servings: 2, cookTime: 20, category: 'lunch', ingredients: ['Quinoa', 'Cucumber', 'Cherry Tomatoes', 'Kalamata Olives', 'Feta Cheese', 'Olive Oil'], steps: ['Cook quinoa and let cool slightly.', 'Dice fresh vegetables.', 'Toss together with olive oil and oregano.', 'Top with crumbled feta cheese.'] },
  { id: 4, title: 'Classic Belgian Berry Waffles', servings: 3, cookTime: 25, category: 'breakfast', ingredients: ['Flour', 'Milk', 'Eggs', 'Baking Powder', 'Butter', 'Fresh Berries', 'Maple Syrup'], steps: ['Whisk dry ingredients with beaten eggs and milk.', 'Pour batter into heated waffle iron until golden.', 'Serve warm topped with berries and syrup.'] }
];

const useQuery = ({ queryFn }) => {
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
};`)
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

    if (stubs.length > 0) {
        const funcMatch = out.match(/(?:export\s+default\s+function|function\s+App|const\s+App\s*=)/)
        if (funcMatch && funcMatch.index !== undefined) {
            const idx = funcMatch.index
            out = out.slice(0, idx) + stubs.join('\n\n') + '\n\n' + out.slice(idx)
        } else {
            out = stubs.join('\n\n') + '\n\n' + out
        }
    }

    return out
}
