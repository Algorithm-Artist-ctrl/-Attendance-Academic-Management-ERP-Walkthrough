import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import { AppContent } from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[VCTM ERP] Root Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            padding: '36px 28px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 16px 45px -10px rgba(15, 23, 42, 0.15)',
          }}>
            <img src="/vctm-logo.png" alt="VCTM Logo" style={{ width: '48px', height: '48px', margin: '0 auto 12px', display: 'block' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>VCTM ERP System Notice</h1>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 20px' }}>
              The portal encountered an unexpected display issue during startup. Your academic and attendance records remain secure.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload ERP Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <AuthProvider>
        <AcademicProvider>
          <AppContent />
        </AcademicProvider>
      </AuthProvider>
    </RootErrorBoundary>
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

