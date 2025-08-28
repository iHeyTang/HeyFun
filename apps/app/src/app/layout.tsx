import { ConfirmDialog } from '@/components/block/confirm';
import { Toaster } from '@/components/ui/sonner';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { AppSidebar } from '@/components/features/app-sidebar';
import { ClerkProvider, OrganizationList, OrganizationSwitcher, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NotificationZh from './notification-zh';
import NotificationEn from './notification-en';
import { ScrollArea } from '@/components/ui/scroll-area';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'HeyFun',
  description: "Hey! Let's bring a little fun to this world together.",
  icons: {
    icon: '/logo.png',
  },
};

const Header = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex items-center justify-between overflow-hidden border-b p-2', className)}>
      <div className="flex items-center gap-2">
        <Link href="/">
          <div className="from-primary/20 to-primary/5 ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border bg-gradient-to-br">
            <Image src="/logo.png" alt="Fun Studio" width={20} height={20} className="object-contain opacity-80" />
          </div>
        </Link>
        <OrganizationSwitcher hidePersonal />
        <Dialog>
          <DialogTrigger asChild>
            <Badge className="cursor-pointer bg-yellow-50 text-yellow-500 transition hover:scale-101">EARLY ACCESS</Badge>
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
      </div>
      <UserButton />
    </div>
  );
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const { orgId } = await auth();

  return (
    <ClerkProvider>
      <html lang={locale} suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} h-screen w-screen overflow-hidden antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <NextIntlClientProvider>
              <SignedIn>
                {!orgId ? (
                  <div className="flex h-full flex-col items-center justify-center">
                    <OrganizationList hidePersonal />
                  </div>
                ) : (
                  <div className="flex h-full flex-col">
                    <Header className="h-12" />
                    <div className="flex h-[calc(100vh-48px)] w-full">
                      <AppSidebar />
                      <div className="h-full flex-1 overflow-hidden">{children}</div>
                    </div>
                  </div>
                )}
              </SignedIn>
            </NextIntlClientProvider>
            <Toaster />
            <ConfirmDialog />
          </ThemeProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
