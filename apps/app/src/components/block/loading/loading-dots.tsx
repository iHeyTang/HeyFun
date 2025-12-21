import { cn } from '@/lib/utils';

export const LoadingDots = ({ label, className }: { label?: string; className?: string }) => {
  return (
    <div className={cn('text-muted-foreground animate-loading-pulse flex items-center gap-1.5', className)}>
      {label}
      <div className="loading-dot" />
      <div className="loading-dot" />
      <div className="loading-dot" />
    </div>
  );
};

export default LoadingDots;
