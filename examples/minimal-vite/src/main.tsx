import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { init } from '@fiber-analytics/browser';
import { App } from './App.js';

const INGEST_ENDPOINT = import.meta.env.VITE_FA_ENDPOINT ?? 'http://localhost:3000/api/ingest';

init({
  endpoint: INGEST_ENDPOINT,
  domain: 'app.com',
  debug: true,
});

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
