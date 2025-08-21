'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Github } from 'lucide-react';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('config.sidebar');
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      <div className="bg-muted/20 border-muted flex h-full w-[200px] flex-col gap-2 border-r">
        <div className="text-muted-foreground px-2 py-2 text-xs font-medium whitespace-nowrap">Settings</div>
        <div className="flex h-full flex-col pl-0.5">
          <Link
            href="/settings/llm"
            className={cn('hover:bg-muted cursor-pointer p-2 text-sm transition-colors', pathname.startsWith('/settings/llm') && 'bg-muted')}
          >
            {t('models')}
          </Link>
          <Link
            href="/settings/aigc"
            className={cn('hover:bg-muted cursor-pointer p-2 text-sm transition-colors', pathname.startsWith('/settings/aigc') && 'bg-muted')}
          >
            {t('aigc')}
          </Link>
          <Link
            href="/settings/agents"
            className={cn('hover:bg-muted cursor-pointer p-2 text-sm transition-colors', pathname.startsWith('/settings/agents') && 'bg-muted')}
          >
            {t('agents')}
          </Link>
          <Link
            href="/settings/preferences"
            className={cn('hover:bg-muted cursor-pointer p-2 text-sm transition-colors', pathname === '/settings/preferences' && 'bg-muted')}
          >
            {t('preferences')}
          </Link>

          {/* Footer */}
          <div className="mt-auto p-2">
            <div className="bg-silver-gradient flex flex-col justify-center gap-2 rounded-lg p-2">
              <div className="text-muted-foreground/80 flex items-center gap-1.5 text-[10px]">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                </svg>
                <span>Version 0.4.1</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                <Github className="h-2.5 w-2.5" />
                <span>Source Code</span>
                <a
                  href="https://github.com/iheytang/heyfun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:underline"
                >
                  GitHub
                </a>
              </div>
              <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span>Powered by</span>
                <a href="https://www.iheytang.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                  iHeyTang
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
