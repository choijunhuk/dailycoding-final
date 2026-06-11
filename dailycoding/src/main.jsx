import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { applyAppTypographyPreference } from './utils/fontPreferences.js'
import { initSentry } from './utils/sentry.js'

initSentry();

const referralCode = new URLSearchParams(window.location.search).get('ref');
if (referralCode) {
  localStorage.setItem('referralCode', referralCode);
}

// Apply saved font preferences before first render to avoid flash
const savedFont = localStorage.getItem('dc_app_font') || 'noto';
const savedFontSize = Number(localStorage.getItem('dc_app_font_size')) || 14;
applyAppTypographyPreference({ fontFamily: savedFont, fontSize: savedFontSize });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
