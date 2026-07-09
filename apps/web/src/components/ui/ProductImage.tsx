import Image from 'next/image';
import { cn } from '@/lib/cn';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  fill?: boolean;
}

export function ProductImage({
  src,
  alt,
  className,
  priority = false,
  sizes = '(max-width: 1024px) 100vw, 50vw',
  fill = true,
}: ProductImageProps) {
  if (!src) {
    return (
      <div className={cn('flex items-center justify-center bg-gradient-to-b from-primary-50 to-primary-100', className)}>
        <svg className="h-24 w-24 opacity-20 text-primary" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 10 L30 25 L10 20 L15 50 L10 80 L50 90 L90 80 L85 50 L90 20 L70 25 Z" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      priority={priority}
      sizes={sizes}
      className={cn('object-cover object-center', className)}
    />
  );
}
