import {Buffer} from 'buffer';
if (typeof global === 'undefined') {
  (window as any).global = window;
}
if (typeof process === 'undefined') {
  (window as any).process = { env: {} };
}
(window as any).Buffer = Buffer;

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
