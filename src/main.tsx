import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installViewportVars } from './ui/useViewport.ts';

/* --app-h, --ui-scale and the HUD frame are on the root before the first paint */
installViewportVars();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
