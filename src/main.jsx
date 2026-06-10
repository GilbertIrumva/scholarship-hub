import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { SavedScholarshipsProvider } from './context/SavedScholarshipsProvider.jsx'
import { ThemedToaster } from './components/ui/toaster.jsx'
import { reportWebVitals } from './lib/webVitals.js'
import { initObservability } from './lib/logger.js'
import './i18n' // initialise EN/FR resources before first render
import './styles/index.css'


// T4.2 — initialise the optional Sentry sink as early as possible so
// unhandled errors during render are captured. No-ops when VITE_SENTRY_DSN
// is unset or `@sentry/react` is not installed.
initObservability()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SavedScholarshipsProvider>
            <App />
            <ThemedToaster />
          </SavedScholarshipsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)

// T4.1 — fire-and-forget Core Web Vitals reporting (no-op in tests/SSR).
reportWebVitals()
