import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary, ToastProvider } from '@todo-p2p/ui';
import '@todo-p2p/ui/styles.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

// M4 E4.1/E4.2: ErrorBoundary catches render throws (recoverable fallback);
// ToastProvider hosts the error/info surface and is mounted above App so App's
// effects (global handlers, peer status, Tauri bridge) can call `useToast`.
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
