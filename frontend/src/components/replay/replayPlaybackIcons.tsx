import React from 'react';

const ICON = 'w-5 h-5';

export const PlayIcon: React.FC = () => (
  <svg className={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5.14v13.72c0 .79.87 1.27 1.54.84l11.14-6.86c.63-.39.63-1.29 0-1.68L9.54 4.3C8.87 3.87 8 4.35 8 5.14z" />
  </svg>
);

export const PauseIcon: React.FC = () => (
  <svg className={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
  </svg>
);

export const ReplayIcon: React.FC = () => (
  <svg className={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
  </svg>
);

export const SkipToStartIcon: React.FC = () => (
  <svg className={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
  </svg>
);

export const StepBackIcon: React.FC = () => (
  <svg className={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18 6v12l-8.5-6L18 6zM7 6h2v12H7V6z" />
  </svg>
);

export const StepForwardIcon: React.FC = () => (
  <svg className={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 18V6l8.5 6L6 18zm9-12h2v12h-2V6z" />
  </svg>
);

export const SkipToEndIcon: React.FC = () => (
  <svg className={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 18V6l8.5 6L6 18zm9.5-12h2v12h-2V6z" />
  </svg>
);
