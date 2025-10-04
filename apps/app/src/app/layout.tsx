import { Toaster } from '@/components/ui/sonner';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
// import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
// });

// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// });

export const metadata: Metadata = {
  title: {
    default: 'HeyFun - Universal AI Studio | Intelligent Workflow Orchestration Platform',
    template: '%s | HeyFun',
  },
  description:
    'HeyFun is a universal AI studio that connects all AI services. Build intelligent agents, automate workflows, and unleash creativity with our customizable, fully-connected AI platform. Empowering solopreneurs and one-person companies in the AI era.',
  keywords: [
    'AI Studio',
    'AI Platform',
    'Artificial Intelligence',
    'Creative Platform',
    'AI Tools',
    'AI Services',
    'Smart Workflow',
    'AI Agent',
    'Intelligent Agent',
    'Universal AI',
    'Creative AI',
    'AI Workflow',
    'Workflow Automation',
    'Machine Learning',
    'Productivity Tools',
    'AI Integration',
    'FlowCanvas',
    'Visual Workflow Builder',
    'Paintboard',
    'AI Canvas',
    'Automation',
    'Task Automation',
    'Open Source',
    'No-Code AI',
    'Low-Code Platform',
    'AI Orchestration',
  ],
  authors: [{ name: 'HeyFun Team', url: 'https://heyfun.ai' }],
  creator: 'HeyFun',
  publisher: 'HeyFun',
  applicationName: 'HeyFun',
  referrer: 'origin-when-cross-origin',
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
      'zh-CN': '/zh-CN',
    },
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/favicon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        url: '/favicon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        url: '/favicon.png',
      },
    ],
  },
  openGraph: {
    title: 'HeyFun - Universal AI Studio | Intelligent Workflow Orchestration',
    description:
      'HeyFun is a universal AI studio that connects all AI services. Build intelligent agents, automate workflows, and unleash creativity. Customizable • Fully Connected • AI Platform',
    url: 'https://heyfun.ai',
    siteName: 'HeyFun',
    images: [
      {
        url: '/favicon.png',
        width: 1200,
        height: 630,
        alt: 'HeyFun - Universal AI Studio',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    alternateLocale: ['zh_CN'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HeyFun - Universal AI Studio | Intelligent Workflow Orchestration',
    description:
      'Build intelligent AI agents, automate workflows, and unleash creativity with HeyFun - the universal AI platform that connects all AI services.',
    images: ['/favicon.png'],
    creator: '@HeyFunAI',
    site: '@HeyFunAI',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  category: 'technology',
  classification: 'Business & Productivity',
  verification: {
    // Add your search engine verification codes here
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
  appleWebApp: {
    capable: true,
    title: 'HeyFun',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <ClerkProvider>
      <html lang={locale} suppressHydrationWarning>
        <body className={`h-screen w-screen overflow-hidden antialiased`}>
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
