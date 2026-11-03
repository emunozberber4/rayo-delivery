import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ClientApp from './ClientApp';
import '@/index.css';

// Register PWA Service Worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration notice:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClientApp />
  </StrictMode>,
);
