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
