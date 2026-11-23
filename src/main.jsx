import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// registra o service worker: habilita "instalar app" e faz o app abrir sem
// internet. Só em produção — no `npm run dev` ele atrapalharia as atualizações.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // se falhar, sem problema — o app funciona normalmente sem ele
    })
  })
}
