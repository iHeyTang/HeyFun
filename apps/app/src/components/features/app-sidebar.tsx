'use client';

import { getMe } from '@/actions/me';
import { pageTasks } from '@/actions/tasks';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tasks } from '@prisma/client';
import { LogOutIcon, MessageSquare, SettingsIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { create } from 'zustand';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import Link from 'next/link';
import Image from 'next/image';
import logo from '@/assets/logo.png';

const navItems = [
  {
    icon: MessageSquare,
    label: 'Tasks',
    path: '/tasks',
  },
];

export const useRecentTasks = create<{ tasks: Tasks[]; refreshTasks: () => Promise<void> }>(set => ({
  tasks: [],
  refreshTasks: async () => {
    const res = await pageTasks({ page: 1, pageSize: 30 });
    set({ tasks: res.data?.tasks || [] });
  },
}));

const useMeStore = create<{ me: Awaited<ReturnType<typeof getMe>>['data'] | null; refreshMe: () => Promise<void> }>(set => ({
  me: null,
  refreshMe: async () => {
    const res = await getMe({});
    if (res.error || !res.data) {
      throw new Error('Failed to fetch user data');
    }
    set({ me: res.data });
  },
}));

export function AppSidebar() {
  const router = useRouter();
  const { me, refreshMe } = useMeStore();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/login' && pathname !== '/register') {
      refreshMe();
    }
  }, []);

  const handleLogout = () => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    router.push('/login');
  };

  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <div className="flex w-14 flex-col items-center justify-between pt-2 shadow">
      <Link href="/">
        <div className="from-primary/20 to-primary/5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border bg-gradient-to-br">
          <Image src={logo} alt="Fun Studio" width={24} height={24} className="object-contain opacity-80" />
        </div>
      </Link>
      <div className="flex flex-1 flex-col items-center space-y-2 pt-4">
        <TooltipProvider>
          {navItems.map(item => (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <Button
                  variant={pathname === item.path || pathname.startsWith(item.path + '/') ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => router.push(item.path)}
                  className="h-9 w-9"
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-10 w-10 cursor-pointer">
              <AvatarFallback className="text-base">{me?.name ? me.name.charAt(0).toUpperCase() : '?'}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer py-2.5">
              <LogOutIcon className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
