import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import { AppContent } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <AcademicProvider>
        <AppContent />
      </AcademicProvider>
    </AuthProvider>
  </React.StrictMode>,
);

// Register production Service Worker for offline shell and fast asset caching
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => {
        console.log('[SW] ServiceWorker registered with scope:', reg.scope);
      },
      (err) => {
        console.warn('[SW] ServiceWorker registration failed:', err);
      }
    );
  });
}

