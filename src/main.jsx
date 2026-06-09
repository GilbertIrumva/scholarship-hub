import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { SavedScholarshipsProvider } from './context/SavedScholarshipsProvider.jsx'
import { ThemedToaster } from './components/ui/toaster.jsx'
import './i18n' // initialise EN/FR resources before first render
import './styles/index.css'


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
