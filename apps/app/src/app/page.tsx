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
      <header className="fixed top-0 right-0 left-0 z-50 backdrop-blur-md">
        <nav className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <ThemeLogo width={24} height={24} alt="HeyFun" className="object-contain" />
              <span className="text-lg font-bold tracking-wide text-neutral-900">HeyFun</span>
            </div>

            {/* Navigation Links */}
            <div className="hidden flex-1 items-center justify-center gap-8 md:flex">
              <Link href="/" className="text-sm font-normal text-neutral-800 transition-colors hover:text-neutral-900">
                {tNav('home')}
              </Link>
              <Link href="/" className="text-sm font-normal text-neutral-800 transition-colors hover:text-neutral-900">
                {tNav('features')}
              </Link>
              <Link href="/" className="text-sm font-normal text-neutral-800 transition-colors hover:text-neutral-900">
                {tNav('openSource')}
              </Link>
              <Link href="/" className="text-sm font-normal text-neutral-800 transition-colors hover:text-neutral-900">
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
                className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-normal text-neutral-800 transition-all hover:text-neutral-900 sm:flex"
              >
                <Github className="h-3 w-3" />
                <span>{tNav('github')}</span>
              </Link>

              {/* Login Button */}
              <Link href="/dashboard">
                <Button size="sm" className="rounded-full">
                  <div className="flex items-center gap-2 px-1">
                    <span>{tNav('dashboard')}</span>
                  </div>
                </Button>
              </Link>

              {/* Mobile Menu */}
              <Button size="sm" variant="ghost" className="text-neutral-800 hover:bg-white hover:text-neutral-900 md:hidden">
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
                <div className="animate-fade-in-title space-y-6">
                  <div className="relative px-4 py-8">
                    <h1 className="text-6xl leading-none font-bold tracking-tight text-neutral-900 md:text-7xl lg:text-8xl">
                      <span className="shimmer-text-dark relative inline-block py-2">
                        HeyFun
                        <div className="absolute -inset-2 bg-gradient-to-r from-transparent via-neutral-600/20 to-transparent opacity-50 blur-sm"></div>
                      </span>
                    </h1>
                    {/* Floating particles around title */}
                    <div className="absolute -top-8 -left-8 h-2 w-2 animate-pulse rounded-full bg-neutral-800/15"></div>
                    <div
                      className="absolute -top-6 -right-8 h-1 w-1 animate-pulse rounded-full bg-neutral-200/20"
                      style={{ animationDelay: '1s' }}
                    ></div>
                    <div
                      className="absolute -bottom-6 -left-6 h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-800/12"
                      style={{ animationDelay: '2s' }}
                    ></div>
                    <div
                      className="absolute -right-8 -bottom-8 h-1 w-1 animate-pulse rounded-full bg-neutral-200/17"
                      style={{ animationDelay: '0.5s' }}
                    ></div>
                  </div>

                  {/* Enhanced divider with glow effect */}
                  <div className="relative mx-auto w-32">
                    <div className="h-px bg-gradient-to-r from-transparent via-neutral-800/30 to-transparent"></div>
                    <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-neutral-600/15 to-transparent blur-sm"></div>
                  </div>

                  {/* Enhanced Badge */}
                  <div className="flex justify-center pt-4">
                    <div className="group relative">
                      <Badge className="cursor-default border-neutral-300 bg-white px-8 py-2 text-sm font-medium text-neutral-800 backdrop-blur-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg">
                        {tHero('badge')}
                      </Badge>
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-neutral-800/5 to-neutral-800/5 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"></div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Subtitle */}
                <div className="animate-fade-in-subtitle space-y-6">
                  <div className="relative">
                    <div className="absolute -inset-2 bg-gradient-to-r from-transparent via-neutral-800/2.5 to-transparent blur-xl"></div>
                  </div>
                  <p className="mx-auto max-w-2xl text-lg leading-relaxed font-normal text-neutral-600">{tHero('subtitle')}</p>
                </div>

                {/* Enhanced Core Features */}
                <div className="animate-fade-in-subtitle mx-auto max-w-4xl">
                  <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    {[
                      { icon: Blocks, title: tHero('features.agents.title'), desc: tHero('features.agents.description'), delay: '0s' },
                      { icon: Workflow, title: tHero('features.workflows.title'), desc: tHero('features.workflows.description'), delay: '0.2s' },
                      { icon: Network, title: tHero('features.integration.title'), desc: tHero('features.integration.description'), delay: '0.4s' },
                      { icon: Layers, title: tHero('features.studio.title'), desc: tHero('features.studio.description'), delay: '0.6s' },
                    ].map((feature, index) => (
                      <div
                        key={index}
                        className="group flex flex-col items-center gap-4 text-center transition-all duration-300 hover:scale-105"
                        style={{ animationDelay: feature.delay }}
                      >
                        <div className="relative">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-200 shadow-lg transition-all duration-300 group-hover:bg-neutral-800/10 group-hover:shadow-xl">
                            <feature.icon className="h-7 w-7 text-neutral-900 transition-all duration-300 group-hover:scale-110" />
                          </div>
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-neutral-800/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-neutral-900">{feature.title}</p>
                          <p className="text-sm font-normal text-neutral-600">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Enhanced CTA Buttons */}
                <div className="animate-fade-in-buttons flex flex-col justify-center gap-6 sm:flex-row">
                  <Link href="/dashboard">
                    <Button
                      size="lg"
                      className="group relative overflow-hidden border-0 bg-neutral-800 px-10 py-4 text-lg font-medium text-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-neutral-900 hover:shadow-2xl"
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

        {/* Enhanced Animated Background Elements */}
        <div className="absolute inset-0 -z-10">
          {/* Minimal Grid System */}
          <div className="absolute inset-0 bg-white bg-[size:8rem_8rem] opacity-1"></div>

          {/* Subtle Radial Gradients */}
          <div
            className="bg-gradient-radial absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full from-neutral-600/0.5 via-transparent to-transparent"
            style={{ animationDuration: '12s' }}
          ></div>
          <div
            className="bg-gradient-radial from-neutral-800/0.8 absolute top-3/4 right-1/4 h-80 w-80 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full via-transparent to-transparent"
            style={{ animationDuration: '10s', animationDelay: '3s' }}
          ></div>
          <div
            className="bg-gradient-radial from-neutral-600/0.3 absolute top-1/2 left-1/6 h-64 w-64 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full via-transparent to-transparent"
            style={{ animationDuration: '15s', animationDelay: '6s' }}
          ></div>

          {/* Minimal Floating Elements */}
          <div
            className="absolute top-20 left-20 h-2 w-2 rotate-45 animate-pulse rounded-sm bg-neutral-800/3"
            style={{ animationDuration: '6s' }}
          ></div>
          <div
            className="absolute top-40 right-32 h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-200/4"
            style={{ animationDuration: '4s', animationDelay: '2s' }}
          ></div>
          <div
            className="absolute bottom-32 left-40 h-2 w-2 rotate-45 animate-spin rounded-sm border border-neutral-800/2.5"
            style={{ animationDuration: '20s' }}
          ></div>

          {/* Subtle Side Accents */}
          <div
            className="absolute top-0 left-0 h-full w-px animate-pulse bg-gradient-to-b from-transparent via-neutral-800/3 to-transparent"
            style={{ animationDuration: '8s' }}
          ></div>
          <div
            className="absolute top-0 right-0 h-full w-px animate-pulse bg-gradient-to-b from-transparent via-neutral-800/3 to-transparent"
            style={{ animationDuration: '8s', animationDelay: '4s' }}
          ></div>

          {/* Gentle Light Beams */}
          <div
            className="absolute top-0 left-1/4 h-full w-px animate-pulse bg-gradient-to-b from-transparent via-neutral-800/2.5 to-transparent"
            style={{ animationDuration: '10s' }}
          ></div>
          <div
            className="absolute top-0 left-3/4 h-full w-px animate-pulse bg-gradient-to-b from-transparent via-neutral-800/2.5 to-transparent"
            style={{ animationDuration: '10s', animationDelay: '5s' }}
          ></div>

          {/* Soft Scanning Effect */}
          <div className="absolute top-0 left-0 h-full w-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full w-1 animate-pulse bg-gradient-to-b from-transparent via-neutral-800/3 to-transparent"
              style={{ animation: 'scanBeam 20s linear infinite' }}
            ></div>
          </div>

          {/* Subtle Mesh Pattern */}
          <div className="absolute inset-0 bg-neutral-50 bg-[length:128px_128px] opacity-2"></div>

          {/* Refined Corner Accents */}
          <div className="absolute top-0 left-0 h-24 w-px bg-gradient-to-b from-neutral-800/6 to-transparent"></div>
          <div className="absolute top-0 left-0 h-px w-24 bg-gradient-to-r from-neutral-800/6 to-transparent"></div>
          <div className="absolute top-0 right-0 h-24 w-px bg-gradient-to-b from-neutral-800/6 to-transparent"></div>
          <div className="absolute top-0 right-0 h-px w-24 bg-gradient-to-l from-neutral-800/6 to-transparent"></div>
          <div className="absolute bottom-0 left-0 h-24 w-px bg-gradient-to-t from-neutral-800/6 to-transparent"></div>
          <div className="absolute bottom-0 left-0 h-px w-24 bg-gradient-to-r from-neutral-800/6 to-transparent"></div>
          <div className="absolute right-0 bottom-0 h-24 w-px bg-gradient-to-t from-neutral-800/6 to-transparent"></div>
          <div className="absolute right-0 bottom-0 h-px w-24 bg-gradient-to-l from-neutral-800/6 to-transparent"></div>

          {/* Crystal Clear Gradient Overlays */}
          <div className="via-neutral-800/0.8 absolute inset-0 bg-gradient-to-br from-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-50/2 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-50/2 via-transparent to-transparent"></div>

          {/* Ethereal Light Reflections */}
          <div className="bg-gradient-radial from-neutral-600/0.6 absolute top-1/4 left-1/4 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full via-transparent to-transparent opacity-20"></div>
          <div className="bg-gradient-radial from-neutral-800/0.8 absolute top-3/4 right-1/4 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full via-transparent to-transparent opacity-15"></div>
          <div className="bg-gradient-radial from-neutral-600/0.4 absolute top-1/2 left-1/6 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full via-transparent to-transparent opacity-12"></div>
        </div>
      </section>
    </div>
  );
}
