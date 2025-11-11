import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { PreferencesProvider } from './hooks/usePreferences';
import { TradingAccountProvider } from './contexts/TradingAccountContext';
import './i18n/config'; // Initialiser i18n

// Appliquer la taille de police depuis localStorage avant le premier rendu pour éviter le flash
try {
  const savedFontSize = localStorage.getItem('font_size');
  if (savedFontSize === 'small' || savedFontSize === 'medium' || savedFontSize === 'large') {
    document.documentElement.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    document.documentElement.classList.add(`font-size-${savedFontSize}`);
  } else {
    // Appliquer la taille par défaut
    document.documentElement.classList.add('font-size-medium');
  }
} catch (e) {
  // Ignorer les erreurs de localStorage
  document.documentElement.classList.add('font-size-medium');
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <PreferencesProvider>
      <TradingAccountProvider>
        <App />
      </TradingAccountProvider>
    </PreferencesProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
