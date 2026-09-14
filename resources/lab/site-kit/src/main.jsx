import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MemoryRouter initialEntries={[(() => {
      try {
        let p = window.location.pathname || '/'
        if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
        return p || '/'
      } catch (e) {
        return '/'
      }
    })()]} initialIndex={0}>
      <App />
    </MemoryRouter>
  </StrictMode>,
)
