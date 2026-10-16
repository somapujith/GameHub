// Fonts (self-hosted via @fontsource; the weight files bundle latin, latin-ext (₹) and telugu).
import '@fontsource/baloo-tammudu-2/400.css';
import '@fontsource/baloo-tammudu-2/600.css';
import '@fontsource/baloo-tammudu-2/700.css';
import '@fontsource/baloo-tammudu-2/800.css';
import '@fontsource/noto-sans-telugu/400.css';
import '@fontsource/noto-sans-telugu/600.css';
import '@fontsource/noto-sans-telugu/700.css';

import './styles/tokens.css';
import './styles/global.css';
import './styles/home.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
