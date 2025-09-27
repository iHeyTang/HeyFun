import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { OrganizationList, OrganizationSwitcher, SignedIn, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { Github } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import NotificationEn from './notification-en';
import NotificationZh from './notification-zh';
import { AppSidebar } from './sidebar';
import { CreditBadge } from '@/components/features/credit-badge';
import { ThemeToggle } from '@/components/features/theme-toggle';
import { ThemeLogo } from '@/components/features/theme-logo';

export const metadata: Metadata = {
  title: 'HeyFun',
  description: "Hey! Let's bring a little fun to this world together.",
  icons: {
    icon: '/favicon.png',
  },
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
        <Dialog>
          <DialogTrigger asChild>
            <Badge className="bg-theme-badge text-theme-badge cursor-pointer transition hover:scale-101">EARLY ACCESS</Badge>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>EARLY ACCESS</DialogTitle>
            </DialogHeader>
            <Tabs className="flex-1">
              <TabsList>
                <TabsTrigger value="zh">中文</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
              </TabsList>
              <TabsContent value="zh">
                <NotificationZh />
              </TabsContent>
              <TabsContent value="en">
                <NotificationEn />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
        <Link href="https://github.com/iHeyTang/HeyFun" target="_blank">
          <Github className="text-muted-foreground h-3 w-3 cursor-pointer" />
        </Link>
      </div>
      <div className="flex items-center gap-4">
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
        <div className="flex h-full flex-col items-center justify-center text-theme-foreground">
          <OrganizationList hidePersonal />
        </div>
      ) : (
        <div className="flex h-full flex-col bg-secondary">
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
