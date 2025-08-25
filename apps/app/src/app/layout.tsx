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
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

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
};

const Header = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex items-center justify-between overflow-hidden border-b p-2', className)}>
      <div className="flex items-center gap-2">
        <Link href="/">
          <div className="from-primary/20 to-primary/5 ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border bg-gradient-to-br">
            <Image src={logo} alt="Fun Studio" width={20} height={20} className="object-contain opacity-80" />
          </div>
        </Link>
        <OrganizationSwitcher hidePersonal />
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
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
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
