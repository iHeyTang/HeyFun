import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LucideIcon } from 'lucide-react';

export interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  disabled?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
}

export const ToolbarButton = ({ icon: Icon, label, onClick, disabled = false, side = 'right', sideOffset }: ToolbarButtonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" onClick={onClick} disabled={disabled} className="hover:bg-muted/50 size-9">
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset}>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default ToolbarButton;
