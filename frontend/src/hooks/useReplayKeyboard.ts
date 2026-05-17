import { useEffect, useRef } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

export interface UseReplayKeyboardOptions {
  enabled: boolean;
  maxIndex: number;
  currentIndex: number;
  onPlayPause: () => void;
  onSeek: (index: number) => void;
}

/** Raccourcis replay : Espace, flèches, Home/End. */
export function useReplayKeyboard({
  enabled,
  maxIndex,
  currentIndex,
  onPlayPause,
  onSeek,
}: UseReplayKeyboardOptions): void {
  const currentIndexRef = useRef(currentIndex);
  const maxIndexRef = useRef(maxIndex);
  const onPlayPauseRef = useRef(onPlayPause);
  const onSeekRef = useRef(onSeek);

  currentIndexRef.current = currentIndex;
  maxIndexRef.current = maxIndex;
  onPlayPauseRef.current = onPlayPause;
  onSeekRef.current = onSeek;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const max = maxIndexRef.current;
      if (max <= 0 && e.key !== ' ') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          onPlayPauseRef.current();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSeekRef.current(Math.max(0, currentIndexRef.current - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSeekRef.current(Math.min(max, currentIndexRef.current + 1));
          break;
        case 'Home':
          e.preventDefault();
          onSeekRef.current(0);
          break;
        case 'End':
          e.preventDefault();
          onSeekRef.current(max);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
