import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'HeyFun - Universal AI Studio',
    template: '%s | HeyFun',
  },
  description:
    'The creative platform that connects all AI services. Customizable, fully connected AI studio providing intelligent workflow orchestration and creative productivity platform.',
  keywords: [
    'AI Studio',
    'AI Platform',
    'Artificial Intelligence',
    'Creative Platform',
    'AI Tools',
    'AI Services',
    'Smart Workflow',
    'AI Agent',
    'Universal AI',
    'Creative AI',
    'AI Workflow',
    'Machine Learning',
    'Productivity Tools',
    'AI Integration',
  ],
  authors: [{ name: 'HeyFun Team' }],
  creator: 'HeyFun',
  publisher: 'HeyFun',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://heyfun.ai'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en',
      'zh-CN': '/zh',
    },
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/logo.png',
    },
  },
  openGraph: {
    title: 'HeyFun - Universal AI Studio',
    description: 'The creative platform that connects all AI services. Customizable • Fully Connected • AI Studio',
    url: 'https://heyfun.ai',
    siteName: 'HeyFun',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'HeyFun - Universal AI Studio',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HeyFun - Universal AI Studio',
    description: 'The creative platform that connects all AI services',
    images: ['/logo.png'],
    creator: '@HeyFunAI',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  category: 'technology',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <ClerkProvider
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: 'hsl(var(--theme-primary))',
          colorBackground: 'hsl(var(--theme-background))',
          colorText: 'hsl(var(--theme-foreground))',
          colorTextSecondary: 'hsl(var(--theme-muted-foreground))',
          colorNeutral: 'hsl(var(--theme-foreground))',
          colorSuccess: 'hsl(var(--theme-success))',
          colorWarning: '#f59e0b',
          colorDanger: 'hsl(var(--theme-destructive))',
          borderRadius: '0.5rem',
        },
        elements: {
          formButtonPrimary: {
            backgroundColor: 'hsl(var(--theme-primary))',
            color: 'hsl(var(--theme-primary-foreground))',
          },
          card: {
            backgroundColor: 'hsl(var(--theme-card))',
            color: 'hsl(var(--theme-card-foreground))',
          },
          headerTitle: {
            color: 'hsl(var(--theme-foreground))',
          },
          headerSubtitle: {
            color: 'hsl(var(--theme-muted-foreground))',
          },
          formFieldInput: {
            backgroundColor: 'hsl(var(--theme-input))',
            color: 'hsl(var(--theme-foreground))',
            borderColor: 'hsl(var(--theme-border))',
          },
        },
      }}
    >
      <html lang={locale} suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} h-screen w-screen overflow-hidden antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <NextIntlClientProvider>
              <div className="h-full flex-1 overflow-hidden">{children}</div>
              <Toaster />
            </NextIntlClientProvider>
          </ThemeProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
