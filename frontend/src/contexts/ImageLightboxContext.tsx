import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IMAGE_LIGHTBOX_OPEN_EVENT } from '../utils/mediaUrl';

const ImageLightboxOverlay: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/90 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('trades:strategyCompliance.openScreenshot')}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-3 right-3 z-10 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        {t('common:close')}
      </button>
      <div className="max-h-[100dvh] max-w-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={url}
          alt=""
          className="max-h-[100dvh] max-w-full w-auto object-contain select-none"
          draggable={false}
        />
      </div>
    </div>
  );
};

export const ImageLightboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url) {
        setOpenUrl(detail.url);
      }
    };
    window.addEventListener(IMAGE_LIGHTBOX_OPEN_EVENT, handler as EventListener);
    return () => window.removeEventListener(IMAGE_LIGHTBOX_OPEN_EVENT, handler as EventListener);
  }, []);

  const close = useCallback(() => setOpenUrl(null), []);

  return (
    <>
      {children}
      {openUrl ? <ImageLightboxOverlay url={openUrl} onClose={close} /> : null}
    </>
  );
};
