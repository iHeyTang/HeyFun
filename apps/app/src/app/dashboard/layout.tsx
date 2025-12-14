import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { OrganizationList, OrganizationSwitcher, SignedIn, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { Github } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppSidebar } from './sidebar';
import { CreditBadge } from '@/components/features/credit-badge';
import { ThemeToggle } from '@/components/features/theme-toggle';
import { LanguageToggle } from '@/components/features/language-toggle';
import { ThemeLogo } from '@/components/features/theme-logo';
import { Button } from '@/components/ui/button';
import { AppInitializer } from '@/components/features/app-initializer';

export const metadata: Metadata = {
  title: 'FlowCanvas',
};

const Header = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex items-center justify-between overflow-hidden border-b p-2', className)}>
      <div className="flex items-center gap-2">
        <Link href="/">
          <div className="from-primary/20 to-primary/5 ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border bg-gradient-to-br">
            <ThemeLogo width={20} height={20} alt="Fun Studio" className="object-contain opacity-80" />
          </div>
        </Link>
        <OrganizationSwitcher hidePersonal />
        <CreditBadge />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="https://github.com/iHeyTang/HeyFun" target="_blank">
            <Github className="text-foreground h-4 w-4" />
          </Link>
        </Button>
        <LanguageToggle />
        <ThemeToggle />
        <UserButton />
      </div>
    </div>
  );
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { orgId } = await auth();

  return (
    <SignedIn>
      {!orgId ? (
        <div className="text-foreground flex h-full flex-col items-center justify-center">
          <OrganizationList hidePersonal />
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <AppInitializer />
          <Header className="h-12" />
          <div className="flex h-[calc(100vh-48px)] w-full">
            <AppSidebar />
            <div className="h-full flex-1 overflow-hidden">{children}</div>
          </div>
        </div>
      )}
    </SignedIn>
  );
}
