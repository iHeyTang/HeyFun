import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface TooltipButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  disabled?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  className?: string;
}

export const TooltipButton = ({ icon, label, onClick, disabled = false, side, sideOffset, className }: TooltipButtonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" onClick={onClick} disabled={disabled} className={cn('hover:bg-muted/50 size-9', className)}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset}>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default TooltipButton;
