import { useEffect, useRef } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  return target.isContentEditable || Boolean(target.closest('[contenteditable="true"]'));
}

type MarketReplayKeyboardOptions = {
  enabled: boolean;
  allowBackward: boolean;
  onPlayPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSpeedChange: (speed: number) => void;
  onLong: () => void;
  onShort: () => void;
  onCancel: () => void;
};

export function useMarketReplayKeyboard(options: MarketReplayKeyboardOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!options.enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const current = optionsRef.current;
      const key = event.key.toLowerCase();
      if (event.key === ' ') {
        event.preventDefault();
        current.onPlayPause();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        current.onStepForward();
      } else if (event.key === 'ArrowLeft' && current.allowBackward) {
        event.preventDefault();
        current.onStepBack();
      } else if (/^[1-5]$/.test(event.key)) {
        current.onSpeedChange([1, 2, 5, 10, 20][Number(event.key) - 1]);
      } else if (key === 'l') {
        current.onLong();
      } else if (key === 's') {
        current.onShort();
      } else if (event.key === 'Escape') {
        current.onCancel();
      } else {
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [options.enabled]);
}
