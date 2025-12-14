'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bot, Flower, Network, Palette, SettingsIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const useNavItems = () => {
  const t = useTranslations('dashboard.sidebar');

  return [
    {
      icon: Bot,
      label: t('agent'),
      path: '/dashboard/agent',
    },
    {
      icon: Flower,
      label: t('flowcanvas'),
      path: '/dashboard/flowcanvas',
    },
    // {
    //   icon: MessageSquare,
    //   label: t('chat'),
    //   path: '/dashboard/chat',
    // },
    // {
    //   icon: Bot,
    //   label: t('tasks'),
    //   path: '/dashboard/tasks',
    // },
    {
      icon: Palette,
      label: t('paintboard'),
      path: '/dashboard/paintboard',
    },
    // {
    //   icon: FolderOpen,
    //   label: t('workspace'),
    //   path: '/dashboard/workspace',
    // },
  ];
};

const useBottomNavItems = () => {
  const t = useTranslations('dashboard.sidebar');

  return [
    // {
    //   icon: BoxIcon,
    //   label: t('tools'),
    //   path: '/dashboard/tools',
    // },
    {
      icon: Network,
      label: t('gateway'),
      path: '/dashboard/ai-gateway',
    },
    {
      icon: SettingsIcon,
      label: t('settings'),
      path: '/dashboard/settings',
    },
  ];
};

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const navItems = useNavItems();
  const bottomNavItems = useBottomNavItems();

  if (pathname === '/signin' || pathname === '/signup') {
    return null;
  }

  return (
    <div className="bg-sidebar flex w-14 flex-col items-center justify-between shadow">
      <div className="flex flex-1 flex-col items-center space-y-2 pt-4">
        <TooltipProvider>
          {navItems.map(item => (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <Button
                  variant={pathname === item.path || pathname.startsWith(item.path + '/') ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => router.push(item.path)}
                  className="h-8 w-8"
                >
                  <item.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 p-4">
        <TooltipProvider>
          {bottomNavItems.map(item => (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <Link key={item.path} href={item.path}>
                  <Button size="icon" className="h-8 w-8" variant={pathname.startsWith(item.path) ? 'default' : 'ghost'}>
                    <item.icon className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
}
