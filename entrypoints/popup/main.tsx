import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/assets/tailwind.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
