import { useEffect, useRef, useState } from 'react';

export function useLazyComponent(options: { rootMargin?: string } = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setHasBeenVisible(true);
        } else {
          setIsVisible(false);
        }
      },
      {
        rootMargin: options.rootMargin || '100px',
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options.rootMargin]);

  return { ref, isVisible, hasBeenVisible };
}
