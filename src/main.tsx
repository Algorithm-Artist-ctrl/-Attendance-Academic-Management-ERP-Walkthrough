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
