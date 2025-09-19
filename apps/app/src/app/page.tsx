import { ThemeToggle } from '@/components/features/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThemeLogo } from '@/components/features/theme-logo';
import { Blocks, Github, Layers, Menu, Network, Workflow } from 'lucide-react';
import Link from 'next/link';
import './page.css';

export default function HomePage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header Navigation */}
      <header className="fixed top-0 right-0 left-0 z-50 backdrop-blur-md">
        <nav className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <ThemeLogo width={24} height={24} alt="HeyFun" className="object-contain" />
              <span className="text-theme-primary text-lg font-bold tracking-wide">HeyFun</span>
            </div>

            {/* Navigation Links */}
            <div className="hidden flex-1 items-center justify-center gap-8 md:flex">
              <Link href="/" className="text-theme-secondary hover:text-theme-primary text-sm font-normal transition-colors">
                Home
              </Link>
              <Link href="/" className="text-theme-secondary hover:text-theme-primary text-sm font-normal transition-colors">
                Features
              </Link>
              <Link href="/" className="text-theme-secondary hover:text-theme-primary text-sm font-normal transition-colors">
                Open Source
              </Link>
              <Link href="/" className="text-theme-secondary hover:text-theme-primary text-sm font-normal transition-colors">
                Pricing
              </Link>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              <ThemeToggle />
              {/* GitHub Info */}
              <Link
                href="https://github.com/iHeyTang/HeyFun"
                target="_blank"
                className="text-theme-secondary hover:text-theme-primary hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-normal transition-all sm:flex"
              >
                <Github className="h-3 w-3" />
                <span>GitHub</span>
              </Link>

              {/* Login Button */}
              <Link href="/dashboard">
                <Button size="sm" className="rounded-full">
                  <div className="flex items-center gap-2 px-1">
                    <span>Dashboard</span>
                  </div>
                </Button>
              </Link>

              {/* Mobile Menu */}
              <Button size="sm" variant="ghost" className="text-theme-secondary hover:bg-theme-secondary hover:text-theme-primary md:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20">
        <div className="relative mx-auto w-full max-w-7xl">
          <div className="flex items-center justify-center">
            {/* Main Content - Centered */}
            <div className="max-w-5xl text-center">
              {/* Product Introduction */}
              <div className="space-y-12">
                {/* Main Title */}
                <div className="animate-fade-in-title space-y-6">
                  <div className="relative px-4 py-8">
                    <h1 className="text-theme-primary text-6xl leading-none font-bold tracking-tight md:text-7xl lg:text-8xl">
                      <span className="shimmer-text-dark relative inline-block py-2">
                        HeyFun
                        <div className="via-theme-primary/20 absolute -inset-2 bg-gradient-to-r from-transparent to-transparent opacity-50 blur-sm"></div>
                      </span>
                    </h1>
                    {/* Floating particles around title */}
                    <div className="bg-theme-primary/15 absolute -top-8 -left-8 h-2 w-2 animate-pulse rounded-full"></div>
                    <div
                      className="bg-theme-secondary/20 absolute -top-6 -right-8 h-1 w-1 animate-pulse rounded-full"
                      style={{ animationDelay: '1s' }}
                    ></div>
                    <div
                      className="bg-theme-primary/12 absolute -bottom-6 -left-6 h-1.5 w-1.5 animate-pulse rounded-full"
                      style={{ animationDelay: '2s' }}
                    ></div>
                    <div
                      className="bg-theme-secondary/17 absolute -right-8 -bottom-8 h-1 w-1 animate-pulse rounded-full"
                      style={{ animationDelay: '0.5s' }}
                    ></div>
                  </div>

                  {/* Enhanced divider with glow effect */}
                  <div className="relative mx-auto w-32">
                    <div className="via-theme-primary/30 h-px bg-gradient-to-r from-transparent to-transparent"></div>
                    <div className="via-theme-primary/15 absolute inset-0 h-px bg-gradient-to-r from-transparent to-transparent blur-sm"></div>
                  </div>

                  {/* Enhanced Badge */}
                  <div className="flex justify-center pt-4">
                    <div className="group relative">
                      <Badge className="border-theme-border bg-theme-badge text-theme-badge cursor-default px-8 py-2 text-sm font-medium backdrop-blur-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg">
                        AI Studio
                      </Badge>
                      <div className="from-theme-primary/5 to-theme-secondary/5 absolute inset-0 rounded-full bg-gradient-to-r opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"></div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Subtitle */}
                <div className="animate-fade-in-subtitle space-y-6">
                  <div className="relative">
                    <div className="via-theme-secondary/2.5 absolute -inset-2 bg-gradient-to-r from-transparent to-transparent blur-xl"></div>
                  </div>
                  <p className="text-theme-tertiary mx-auto max-w-2xl text-lg leading-relaxed font-normal">
                    Intelligent Agents • Automated Workflows • Creative AI Platform
                  </p>
                </div>

                {/* Enhanced Core Features */}
                <div className="animate-fade-in-subtitle mx-auto max-w-4xl">
                  <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    {[
                      { icon: Blocks, title: 'AI Agents', desc: 'Intelligent Autonomous Agents', delay: '0s' },
                      { icon: Workflow, title: 'Workflows', desc: 'Automated Task Orchestration', delay: '0.2s' },
                      { icon: Network, title: 'Integration', desc: 'Seamless AI Service Connection', delay: '0.4s' },
                      { icon: Layers, title: 'Studio', desc: 'Creative AI Development Platform', delay: '0.6s' },
                    ].map((feature, index) => (
                      <div
                        key={index}
                        className="group flex flex-col items-center gap-4 text-center transition-all duration-300 hover:scale-105"
                        style={{ animationDelay: feature.delay }}
                      >
                        <div className="relative">
                          <div className="bg-theme-secondary group-hover:bg-theme-primary/10 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg transition-all duration-300 group-hover:shadow-xl">
                            <feature.icon className="text-theme-primary h-7 w-7 transition-all duration-300 group-hover:scale-110" />
                          </div>
                          <div className="from-theme-primary/10 absolute inset-0 rounded-2xl bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-theme-primary text-base font-semibold">{feature.title}</p>
                          <p className="text-theme-tertiary text-sm font-normal">{feature.desc}</p>
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
                      className="group bg-theme-button-primary text-theme-primary-foreground hover:bg-theme-button-primary-hover relative overflow-hidden border-0 px-10 py-4 text-lg font-medium shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                    >
                      <span className="relative z-10">Get Started</span>
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"></div>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Animated Background Elements */}
        <div className="absolute inset-0 -z-10">
          {/* Minimal Grid System */}
          <div className="bg-theme-grid absolute inset-0 bg-[size:8rem_8rem] opacity-1"></div>

          {/* Subtle Radial Gradients */}
          <div
            className="bg-gradient-radial from-theme-primary/0.5 absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full via-transparent to-transparent"
            style={{ animationDuration: '12s' }}
          ></div>
          <div
            className="bg-gradient-radial from-theme-secondary/0.8 absolute top-3/4 right-1/4 h-80 w-80 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full via-transparent to-transparent"
            style={{ animationDuration: '10s', animationDelay: '3s' }}
          ></div>
          <div
            className="bg-gradient-radial from-theme-primary/0.3 absolute top-1/2 left-1/6 h-64 w-64 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full via-transparent to-transparent"
            style={{ animationDuration: '15s', animationDelay: '6s' }}
          ></div>

          {/* Minimal Floating Elements */}
          <div
            className="bg-theme-primary/3 absolute top-20 left-20 h-2 w-2 rotate-45 animate-pulse rounded-sm"
            style={{ animationDuration: '6s' }}
          ></div>
          <div
            className="bg-theme-secondary/4 absolute top-40 right-32 h-1.5 w-1.5 animate-bounce rounded-full"
            style={{ animationDuration: '4s', animationDelay: '2s' }}
          ></div>
          <div
            className="border-theme-primary/2.5 absolute bottom-32 left-40 h-2 w-2 rotate-45 animate-spin rounded-sm border"
            style={{ animationDuration: '20s' }}
          ></div>

          {/* Subtle Side Accents */}
          <div
            className="via-theme-primary/3 absolute top-0 left-0 h-full w-px animate-pulse bg-gradient-to-b from-transparent to-transparent"
            style={{ animationDuration: '8s' }}
          ></div>
          <div
            className="via-theme-secondary/3 absolute top-0 right-0 h-full w-px animate-pulse bg-gradient-to-b from-transparent to-transparent"
            style={{ animationDuration: '8s', animationDelay: '4s' }}
          ></div>

          {/* Gentle Light Beams */}
          <div
            className="via-theme-primary/2.5 absolute top-0 left-1/4 h-full w-px animate-pulse bg-gradient-to-b from-transparent to-transparent"
            style={{ animationDuration: '10s' }}
          ></div>
          <div
            className="via-theme-secondary/2.5 absolute top-0 left-3/4 h-full w-px animate-pulse bg-gradient-to-b from-transparent to-transparent"
            style={{ animationDuration: '10s', animationDelay: '5s' }}
          ></div>

          {/* Soft Scanning Effect */}
          <div className="absolute top-0 left-0 h-full w-full overflow-hidden">
            <div
              className="via-theme-primary/3 absolute top-0 left-0 h-full w-1 animate-pulse bg-gradient-to-b from-transparent to-transparent"
              style={{ animation: 'scanBeam 20s linear infinite' }}
            ></div>
          </div>

          {/* Subtle Mesh Pattern */}
          <div className="bg-theme-mesh absolute inset-0 bg-[length:128px_128px] opacity-2"></div>

          {/* Refined Corner Accents */}
          <div className="from-theme-primary/6 absolute top-0 left-0 h-24 w-px bg-gradient-to-b to-transparent"></div>
          <div className="from-theme-primary/6 absolute top-0 left-0 h-px w-24 bg-gradient-to-r to-transparent"></div>
          <div className="from-theme-secondary/6 absolute top-0 right-0 h-24 w-px bg-gradient-to-b to-transparent"></div>
          <div className="from-theme-secondary/6 absolute top-0 right-0 h-px w-24 bg-gradient-to-l to-transparent"></div>
          <div className="from-theme-primary/6 absolute bottom-0 left-0 h-24 w-px bg-gradient-to-t to-transparent"></div>
          <div className="from-theme-primary/6 absolute bottom-0 left-0 h-px w-24 bg-gradient-to-r to-transparent"></div>
          <div className="from-theme-secondary/6 absolute right-0 bottom-0 h-24 w-px bg-gradient-to-t to-transparent"></div>
          <div className="from-theme-secondary/6 absolute right-0 bottom-0 h-px w-24 bg-gradient-to-l to-transparent"></div>

          {/* Crystal Clear Gradient Overlays */}
          <div className="via-theme-primary/0.8 absolute inset-0 bg-gradient-to-br from-transparent to-transparent"></div>
          <div className="from-theme-bg-primary/2 absolute inset-0 bg-gradient-to-t via-transparent to-transparent"></div>
          <div className="from-theme-bg-primary/2 absolute inset-0 bg-gradient-to-b via-transparent to-transparent"></div>

          {/* Ethereal Light Reflections */}
          <div className="bg-gradient-radial from-theme-primary/0.6 absolute top-1/4 left-1/4 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full via-transparent to-transparent opacity-20"></div>
          <div className="bg-gradient-radial from-theme-secondary/0.8 absolute top-3/4 right-1/4 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full via-transparent to-transparent opacity-15"></div>
          <div className="bg-gradient-radial from-theme-primary/0.4 absolute top-1/2 left-1/6 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full via-transparent to-transparent opacity-12"></div>
        </div>
      </div>
    </div>
  );
}
