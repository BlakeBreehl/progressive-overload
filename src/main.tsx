import {startupTrace} from './lib/startupDiagnostic';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/AuthProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode><AuthProvider><App /></AuthProvider></StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}

// Recover a stale cached HTML/chunk combination once, without a manual refresh loop.
window.addEventListener('vite:preloadError',event=>{
  startupTrace('Features','stale chunk recovery','event');
  const key='progressive-overload-2.0:chunk-recovery:'+import.meta.url;
  try{if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'attempted');event.preventDefault();window.location.reload();}}catch{/* Feature boundary retains a visible retry if storage is unavailable. */}
});
