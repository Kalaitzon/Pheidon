import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';
import './styles/tokens.css';
import { applyTheme, useSettings } from './store/settings';

// Πριν το πρώτο render, αλλιώς η σελίδα αναβοσβήνει άσπρη σε σκούρο θέμα.
applyTheme(useSettings.getState().theme);

/*
 * Ο service worker καταχωρείται μόνο σε παραγωγή.
 *
 * Σε ανάπτυξη θα σέρβιρε παλιά αρχεία από την cache και θα νόμιζες ότι οι
 * αλλαγές σου δεν εφαρμόζονται.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[pheidon] Ο service worker δεν καταχωρήθηκε:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
