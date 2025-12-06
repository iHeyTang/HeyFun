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
    default: 'HeyFun - AI Creative Content Generation Platform',
    template: '%s | HeyFun',
  },
  description:
    'HeyFun is a professional AI creative content generation platform. Create stunning images, videos, art, and designs with AI-powered tools. Your all-in-one AI creative studio for limitless inspiration.',
  keywords: [
    'HeyFun',
    'AI Creative Content',
    'AI Image Generation',
    'AI Video Creation',
    'AI Art Design',
    'AI Painting',
    'AI Creative Tools',
    'AI Design Platform',
    'Creative Studio',
    'AI Content Generation',
    'AI Image Editing',
    'AI Art Creation',
    'Text to Image',
    'Image to Video',
    'Generative AI',
    'AI Art Generator',
    'AI Video Generator',
    'Digital Art Creation',
    'Creative AI Platform',
    'Tapnow Alternative',
    'Lovart Alternative',
    'Jaaz Alternative',
    'Open Source AI',
    'AI Studio',
    'AI Creator',
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
    title: 'HeyFun - AI Creative Content Generation Platform',
    description:
      'Create stunning images, videos, art, and designs with AI-powered creative tools. Your all-in-one AI creative studio for limitless inspiration.',
    url: 'https://heyfun.ai',
    siteName: 'HeyFun',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'HeyFun - AI Creative Content Generation Platform',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    alternateLocale: ['zh_CN', 'ja_JP', 'ko_KR'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HeyFun - AI Creative Content Generation Platform',
    description: 'Create stunning AI-powered images, videos, art, and designs. Your all-in-one creative studio for limitless inspiration.',
    images: ['/logo.png'],
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
  classification: 'Multimedia & Design',
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
