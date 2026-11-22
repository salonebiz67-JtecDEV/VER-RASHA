import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { APP_BASE_PATH } from './config/api';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    const swUrl = `${APP_BASE_PATH}sw.js`;
    navigator.serviceWorker
      .register(swUrl, { scope: APP_BASE_PATH })
      .catch(() => {
        // Ignore Service Worker registration failures in unsupported restricted WebViews
      });
  });
}
