import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LucideIcon } from 'lucide-react';

export interface MenuAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

export interface ToolbarMenuButtonProps {
  icon: LucideIcon;
  label: string;
  actions: MenuAction[];
  disabled?: boolean;
}

export const ToolbarMenuButton = ({ icon: Icon, label, actions, disabled = false }: ToolbarMenuButtonProps) => {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" disabled={disabled} className="hover:bg-muted/50 size-9">
              <Icon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side="right" sideOffset={8}>
        {actions.map((action, index) => {
          const ActionIcon = action.icon;
          return (
            <DropdownMenuItem key={index} onClick={action.onClick} className="cursor-pointer gap-2">
              <ActionIcon className="size-4" />
              <span>{action.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ToolbarMenuButton;

