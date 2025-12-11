import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  className?: string;
  fallback?: string;
}

/**
 * Composant Image optimisé pour le SEO
 * - Lazy loading par défaut
 * - Dimensions définies pour éviter CLS
 * - Support WebP avec fallback
 * - Alt text obligatoire
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  lazy = true,
  className = '',
  fallback,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!lazy || !imgRef.current) return;

    const currentImg = imgRef.current; // Copier la référence pour le cleanup

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px', // Commencer à charger 50px avant que l'image soit visible
      }
    );

    if (currentImg) {
      observer.observe(currentImg);
    }

    return () => {
      if (currentImg) {
        observer.unobserve(currentImg);
      }
    };
  }, [lazy]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    if (fallback && imgRef.current) {
      imgRef.current.src = fallback;
    }
  };

  // Si lazy loading, utiliser data-src
  const imageSrc = lazy && !isLoaded ? undefined : src;
  const dataSrc = lazy && !isLoaded ? src : undefined;

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      data-src={dataSrc}
      alt={alt}
      width={width}
      height={height}
      className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      loading={lazy ? 'lazy' : 'eager'}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
};

export default OptimizedImage;
