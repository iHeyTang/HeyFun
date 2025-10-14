import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export interface ToolbarPanelProps {
  children: ReactNode;
  className?: string;
}

export const ToolbarPanel = ({ children, className }: ToolbarPanelProps) => {
  return (
    <div
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/80 flex flex-col items-center gap-1 rounded-full border p-1.5 py-4 shadow-lg backdrop-blur',
        className,
      )}
    >
      {children}
    </div>
  );
};

export default ToolbarPanel;
