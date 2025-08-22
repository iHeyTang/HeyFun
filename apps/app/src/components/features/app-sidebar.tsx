'use client';

import { pageTasks } from '@/actions/tasks';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tasks } from '@prisma/client';
import { MessageSquare, Palette, SettingsIcon, Bot } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { create } from 'zustand';
import Link from 'next/link';
import Image from 'next/image';
import logo from '@/assets/logo.png';
import { SignedIn, UserButton, SignedOut, SignUpButton, SignInButton } from '@clerk/nextjs';

const navItems = [
  {
    icon: MessageSquare,
    label: 'Chat',
    path: '/chat',
  },
  {
    icon: Bot,
    label: 'Tasks',
    path: '/tasks',
  },
  {
    icon: Palette,
    label: 'Paintboard',
    path: '/paintboard',
  },
];

export const useRecentTasks = create<{ tasks: Tasks[]; refreshTasks: () => Promise<void> }>(set => ({
  tasks: [],
  refreshTasks: async () => {
    const res = await pageTasks({ page: 1, pageSize: 30 });
    set({ tasks: res.data?.tasks || [] });
  },
}));

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === '/signin' || pathname === '/signup') {
    return null;
  }

  return (
    <div className="flex w-14 flex-col items-center justify-between shadow">
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
        <Link href="/settings/llm">
          <Button size="icon" className="h-10 w-10" variant={pathname.startsWith('/settings') ? 'default' : 'ghost'}>
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
