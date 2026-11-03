import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RiderAppContainer from './RiderAppContainer';
import '@/index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration notice:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RiderAppContainer />
  </StrictMode>,
);
