import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { loadRuntimeConfig } from './lib/config';

async function initializeApp() {
  try {
    await loadRuntimeConfig();
  } catch (error) {
    console.warn('Failed to load runtime configuration, using defaults:', error);
  }

  createRoot(document.getElementById('root')!).render(<App />);
}

void initializeApp();