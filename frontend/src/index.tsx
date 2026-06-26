import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Chart } from 'chart.js';
import { chartTooltipResetPlugin } from './plugins/chartTooltipResetPlugin';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { PreferencesProvider } from './hooks/preferencesProvider';
import { TradingAccountProvider } from './contexts/TradingAccountContext';
import { queryClient } from './lib/queryClient';
import {
  applyAppFontFamily,
  getStoredAppFontFamily,
  syncChartFontFamily,
} from './utils/chartConfig';
import './i18n/config'; // Initialiser i18n

const initialFontStack = applyAppFontFamily(getStoredAppFontFamily());
syncChartFontFamily(initialFontStack);
Chart.defaults.font.family = initialFontStack;
Chart.register(chartTooltipResetPlugin);
Chart.defaults.events = ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'];

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
} catch {
  // Ignorer les erreurs de localStorage
  document.documentElement.classList.add('font-size-medium');
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <TradingAccountProvider>
          <App />
        </TradingAccountProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
