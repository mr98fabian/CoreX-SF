import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/kx.css' // <--- ESTA LINEA ES LA CLAVE

import './lib/installPrompt' // capture beforeinstallprompt on page load (fires once)
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { QueryProvider } from './providers/QueryProvider.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

