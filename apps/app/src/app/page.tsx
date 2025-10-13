import { ThemeToggle } from '@/components/features/theme-toggle';
import { LanguageToggle } from '@/components/features/language-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThemeLogo } from '@/components/features/theme-logo';
import { Blocks, Github, Layers, Menu, Network, Workflow } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import './page.css';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'HeyFun - Universal AI Studio | Intelligent Workflow Orchestration Platform',
  description:
    'HeyFun is a universal AI studio connecting all AI services. Build intelligent agents, automate workflows, and create with AI-powered tools. Open-source, customizable, and fully connected platform empowering solopreneurs and one-person companies.',
  keywords: [
    'HeyFun',
    'AI Studio',
    'Universal AI Platform',
    'Intelligent Workflow',
    'AI Agent',
    'Creative Platform',
    'Workflow Automation',
    'FlowCanvas',
    'Visual Workflow Builder',
    'Paintboard',
    'AI Canvas',
    'Open Source AI',
    'No-Code AI Platform',
  ],
  openGraph: {
    title: 'HeyFun - Universal AI Studio | Intelligent Workflow Orchestration Platform',
    description:
      'Build intelligent AI agents, automate workflows, and create with AI-powered tools. Open-source platform connecting all AI services.',
    url: 'https://heyfun.ai',
    type: 'website',
  },
  alternates: {
    canonical: 'https://heyfun.ai',
  },
};

export default async function HomePage() {
  const t = await getTranslations('home');
  const tNav = await getTranslations('home.nav');
  const tHero = await getTranslations('home.hero');

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header Navigation */}
      <header className="fixed top-0 right-0 left-0 z-50 text-white backdrop-blur-md">
        <nav className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Image src="/logo-white.png" alt="HeyFun" width={24} height={24} className="object-contain" />
              <span className="text-lg font-bold tracking-wide">HeyFun</span>
            </div>

            {/* Navigation Links */}
            <div className="hidden flex-1 items-center justify-center gap-8 md:flex">
              <Link href="/" className="text-sm font-normal transition-colors hover:text-neutral-500">
                {tNav('home')}
              </Link>
              <Link href="/" className="text-sm font-normal transition-colors hover:text-neutral-500">
                {tNav('features')}
              </Link>
              <Link href="/" className="text-sm font-normal transition-colors hover:text-neutral-500">
                {tNav('openSource')}
              </Link>
              <Link href="/" className="text-sm font-normal transition-colors hover:text-neutral-500">
                {tNav('pricing')}
              </Link>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              <LanguageToggle />
              <ThemeToggle />
              {/* GitHub Info */}
              <Link
                href="https://github.com/iHeyTang/HeyFun"
                target="_blank"
                className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-normal transition-all hover:text-neutral-900 sm:flex"
              >
                <Github className="h-3 w-3" />
                <span>{tNav('github')}</span>
              </Link>

              {/* Login Button */}
              <Link href="/dashboard">
                <Button size="sm" className="rounded-full bg-black/50 backdrop-blur-3xl">
                  <div className="flex items-center gap-2 px-1">
                    <span>{tNav('dashboard')}</span>
                  </div>
                </Button>
              </Link>

              {/* Mobile Menu */}
              <Button size="sm" variant="ghost" className="hover:bg-white hover:text-neutral-900 md:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </nav>
      </header>

      {/* Structured Data - JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'HeyFun',
            alternateName: 'HeyFun AI Studio',
            url: 'https://heyfun.ai',
            description:
              'HeyFun is a universal AI studio that connects all AI services. Build intelligent agents, automate workflows, and unleash creativity with our AI-powered platform.',
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://heyfun.ai/search?q={search_term_string}',
              },
              'query-input': 'required name=search_term_string',
            },
            publisher: {
              '@type': 'Organization',
              name: 'HeyFun',
              url: 'https://heyfun.ai',
              logo: {
                '@type': 'ImageObject',
                url: 'https://heyfun.ai/logo.png',
              },
              sameAs: ['https://github.com/iHeyTang/HeyFun'],
            },
            mainEntity: {
              '@type': 'SoftwareApplication',
              name: 'HeyFun',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '100',
              },
            },
            inLanguage: ['zh-CN', 'en-US'],
          }),
        }}
      />

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20">
        <div className="relative mx-auto w-full max-w-7xl">
          <article className="flex items-center justify-center">
            {/* Main Content - Centered */}
            <div className="max-w-5xl text-center">
              {/* Product Introduction */}
              <div className="space-y-12">
                {/* Main Title */}
                <div className="animate-fade-in-title space-y-6 text-white">
                  <div className="px-4 py-8">
                    <h1 className="text-6xl leading-none font-bold tracking-tight md:text-7xl lg:text-8xl">HeyFun</h1>
                  </div>
                </div>

                {/* Subtitle */}
                <div className="animate-fade-in-subtitle">
                  <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-white">{tHero('subtitle')}</p>
                </div>

                {/* Enhanced CTA Buttons */}
                <div className="animate-fade-in-buttons flex flex-col justify-center gap-6 sm:flex-row">
                  <Link href="/dashboard">
                    <Button
                      size="lg"
                      className="group relative overflow-hidden border-0 bg-black/50 px-10 py-4 text-lg font-medium text-white shadow-xl backdrop-blur-3xl transition-all duration-300 hover:scale-105 hover:bg-neutral-900 hover:shadow-2xl"
                    >
                      <span className="relative z-10">{tHero('getStarted')}</span>
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"></div>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* Video Background */}
        <div className="absolute inset-0 -z-10">
          <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover">
            <source src="https://cdn.heyfun.ai/hero-bar/alice.mp4" type="video/mp4" />
          </video>
        </div>
      </section>
    </div>
  );
}
