import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Blocks, Github, Layers, Menu, Network, Workflow } from 'lucide-react';
import Image from 'next/image';
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
              <Image src="/logo.png" alt="HeyFun" width={24} height={24} className="object-contain" />
              <span className="text-lg font-bold tracking-wide text-gray-900">HeyFun</span>
            </div>

            {/* Navigation Links */}
            <div className="hidden flex-1 items-center justify-center gap-8 md:flex">
              <Link href="/" className="text-sm font-normal text-gray-600 transition-colors hover:text-gray-900">
                Home
              </Link>
              <Link href="/" className="text-sm font-normal text-gray-600 transition-colors hover:text-gray-900">
                Features
              </Link>
              <Link href="/" className="text-sm font-normal text-gray-600 transition-colors hover:text-gray-900">
                Open Source
              </Link>
              <Link href="/" className="text-sm font-normal text-gray-600 transition-colors hover:text-gray-900">
                Pricing
              </Link>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {/* GitHub Info */}
              <Link
                href="https://github.com/iHeyTang/HeyFun"
                target="_blank"
                className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-normal text-gray-600 transition-all hover:text-gray-900 sm:flex"
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
              <Button size="sm" variant="ghost" className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 md:hidden">
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
            <div className="max-w-4xl text-center">
              {/* Product Introduction */}
              <div className="space-y-8">
                {/* Main Title */}
                <div className="animate-fade-in-title space-y-4">
                  <h1 className="text-5xl font-bold tracking-tight text-gray-900">
                    <span className="shimmer-text-dark">HeyFun</span>
                  </h1>
                  <div className="mx-auto h-px w-24 bg-gradient-to-r from-gray-300 via-gray-500 to-gray-300"></div>

                  {/* Badge */}
                  <div className="flex justify-center pt-2">
                    <Badge className="cursor-default border-gray-200 bg-gray-50/50 px-6 py-1 text-sm font-normal text-gray-600 backdrop-blur-sm">
                      Universal AI Studio
                    </Badge>
                  </div>
                </div>

                {/* Subtitle */}
                <div className="animate-fade-in-subtitle space-y-4">
                  <p className="text-xl leading-relaxed font-light text-gray-600 md:text-2xl">The creative platform that connects all AI services</p>
                  <p className="mx-auto max-w-lg text-base leading-relaxed font-normal text-gray-500">Customizable • Fully Connected • AI Studio</p>
                </div>

                {/* Core Features */}
                <div className="animate-fade-in-subtitle mx-auto max-w-lg">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 shadow-sm/3">
                        <Blocks className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Customizable</p>
                        <p className="text-xs font-normal text-gray-500">Tailored AI Agents</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 shadow-sm/3">
                        <Network className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Fully Connected</p>
                        <p className="text-xs font-normal text-gray-500">Unified AI Services</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 shadow-sm/3">
                        <Workflow className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Workflow</p>
                        <p className="text-xs font-normal text-gray-500">Intelligent Task Orchestration</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 shadow-sm/3">
                        <Layers className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">AI Studio</p>
                        <p className="text-xs font-normal text-gray-500">Creative Productivity Platform</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="animate-fade-in-buttons flex flex-col justify-center gap-4 sm:flex-row">
                  <Link href="/dashboard">
                    <Button
                      size="lg"
                      className="group border-0 bg-gray-900 px-8 py-3 text-base font-medium text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-gray-800 hover:shadow-xl"
                    >
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 -z-10">
          {/* Enhanced Side Glow Effects */}
          <div
            className="absolute top-0 left-0 h-full w-0.5 animate-pulse bg-gradient-to-b from-transparent via-gray-300 to-transparent opacity-80"
            style={{ animationDuration: '2s' }}
          ></div>
          <div
            className="absolute top-0 right-0 h-full w-0.5 animate-pulse bg-gradient-to-b from-transparent via-gray-300 to-transparent opacity-80"
            style={{ animationDuration: '2s', animationDelay: '1s' }}
          ></div>

          {/* Enhanced Side Effects */}
          {/* Left side layered effects */}
          <div
            className="absolute top-0 left-0 h-full w-32 animate-pulse bg-gradient-to-r from-gray-50/20 to-transparent"
            style={{ animationDuration: '6s' }}
          ></div>
          <div
            className="absolute top-0 left-0 h-full w-8 animate-pulse bg-gradient-to-r from-gray-100/15 to-transparent"
            style={{ animationDuration: '4s', animationDelay: '1s' }}
          ></div>

          {/* Right side layered effects */}
          <div
            className="absolute top-0 right-0 h-full w-32 animate-pulse bg-gradient-to-l from-gray-50/20 to-transparent"
            style={{ animationDuration: '6s', animationDelay: '3s' }}
          ></div>
          <div
            className="absolute top-0 right-0 h-full w-8 animate-pulse bg-gradient-to-l from-gray-100/15 to-transparent"
            style={{ animationDuration: '4s', animationDelay: '2s' }}
          ></div>

          {/* Vertical rhythm lines */}
          <div
            className="absolute top-0 left-4 h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-200/40 to-transparent"
            style={{ animationDuration: '5s' }}
          ></div>
          <div
            className="absolute top-0 left-12 h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-200/30 to-transparent"
            style={{ animationDuration: '7s', animationDelay: '2s' }}
          ></div>
          <div
            className="absolute top-0 right-4 h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-200/40 to-transparent"
            style={{ animationDuration: '5s', animationDelay: '1.5s' }}
          ></div>
          <div
            className="absolute top-0 right-12 h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-200/30 to-transparent"
            style={{ animationDuration: '7s', animationDelay: '3.5s' }}
          ></div>

          {/* Radial Glow from Center */}
          <div
            className="bg-gradient-radial absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full from-gray-100/20 via-gray-50/10 to-transparent opacity-60"
            style={{ animationDuration: '6s' }}
          ></div>

          {/* Dynamic Grid Pattern */}
          <div
            className="absolute inset-0 animate-pulse bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:8rem_8rem] opacity-20"
            style={{ animationDuration: '4s' }}
          ></div>

          {/* Matrix-like falling particles */}
          <div
            className="absolute top-0 left-[10%] h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-300 to-transparent opacity-20"
            style={{ animationDelay: '0s', animationDuration: '3s' }}
          ></div>
          <div
            className="absolute top-0 left-[25%] h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-200 to-transparent opacity-15"
            style={{ animationDelay: '1s', animationDuration: '4s' }}
          ></div>
          <div
            className="absolute top-0 left-[40%] h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-300 to-transparent opacity-18"
            style={{ animationDelay: '2s', animationDuration: '3.5s' }}
          ></div>
          <div
            className="absolute top-0 left-[60%] h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-200 to-transparent opacity-22"
            style={{ animationDelay: '0.5s', animationDuration: '4.5s' }}
          ></div>
          <div
            className="absolute top-0 left-[75%] h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-300 to-transparent opacity-16"
            style={{ animationDelay: '1.5s', animationDuration: '3s' }}
          ></div>
          <div
            className="absolute top-0 left-[90%] h-full w-px animate-pulse bg-gradient-to-b from-transparent via-gray-200 to-transparent opacity-25"
            style={{ animationDelay: '2.5s', animationDuration: '4s' }}
          ></div>

          {/* Floating geometric elements with enhanced effects */}
          <div className="absolute top-20 left-20 h-2 w-2 animate-ping rounded-full bg-gray-300 opacity-15"></div>
          <div className="absolute top-40 right-32 h-1 w-1 animate-pulse rounded-full bg-gray-400 opacity-20"></div>
          <div
            className="absolute bottom-32 left-40 h-3 w-3 rotate-45 animate-spin border border-gray-300 opacity-15"
            style={{ animationDuration: '20s' }}
          ></div>
          <div className="absolute top-60 right-20 h-2 w-2 animate-bounce rounded-full bg-gray-300 opacity-10" style={{ animationDelay: '2s' }}></div>

          {/* Left side details */}
          <div
            className="absolute top-1/4 left-2 h-0.5 w-12 animate-pulse bg-gradient-to-r from-gray-200 to-transparent opacity-50"
            style={{ animationDuration: '4s' }}
          ></div>
          <div
            className="absolute top-1/2 left-6 h-0.5 w-8 animate-pulse bg-gradient-to-r from-gray-300 to-transparent opacity-40"
            style={{ animationDuration: '5s', animationDelay: '1s' }}
          ></div>
          <div
            className="absolute top-3/4 left-2 h-0.5 w-10 animate-pulse bg-gradient-to-r from-gray-200 to-transparent opacity-45"
            style={{ animationDuration: '6s', animationDelay: '2s' }}
          ></div>

          {/* Right side details */}
          <div
            className="absolute top-1/4 right-2 h-0.5 w-12 animate-pulse bg-gradient-to-l from-gray-200 to-transparent opacity-50"
            style={{ animationDuration: '4s', animationDelay: '2s' }}
          ></div>
          <div
            className="absolute top-1/2 right-6 h-0.5 w-8 animate-pulse bg-gradient-to-l from-gray-300 to-transparent opacity-40"
            style={{ animationDuration: '5s', animationDelay: '3s' }}
          ></div>
          <div
            className="absolute top-3/4 right-2 h-0.5 w-10 animate-pulse bg-gradient-to-l from-gray-200 to-transparent opacity-45"
            style={{ animationDuration: '6s', animationDelay: '4s' }}
          ></div>

          {/* Side floating elements */}
          <div className="absolute top-1/3 left-8 h-1 w-1 animate-pulse rounded-full bg-gray-300/60" style={{ animationDuration: '3s' }}></div>
          <div
            className="absolute top-2/3 left-16 h-0.5 w-0.5 animate-pulse rounded-full bg-gray-400/50"
            style={{ animationDuration: '4s', animationDelay: '1s' }}
          ></div>
          <div
            className="absolute top-1/3 right-8 h-1 w-1 animate-pulse rounded-full bg-gray-300/60"
            style={{ animationDuration: '3s', animationDelay: '1.5s' }}
          ></div>
          <div
            className="absolute top-2/3 right-16 h-0.5 w-0.5 animate-pulse rounded-full bg-gray-400/50"
            style={{ animationDuration: '4s', animationDelay: '2.5s' }}
          ></div>

          {/* Floating dots with movement */}
          <div
            className="floating-dot absolute top-1/3 right-1/3 h-2 w-2 animate-bounce rounded-full bg-gray-400/60"
            style={{ animationDuration: '3s' }}
          ></div>
          <div
            className="floating-dot absolute top-2/3 left-1/3 h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300/50"
            style={{ animationDuration: '4s', animationDelay: '1s' }}
          ></div>

          {/* Corner accent lines */}
          <div className="absolute top-0 left-0 h-24 w-px bg-gradient-to-b from-gray-200 to-transparent opacity-40"></div>
          <div className="absolute top-0 left-0 h-px w-24 bg-gradient-to-r from-gray-200 to-transparent opacity-40"></div>
          <div className="absolute top-0 right-0 h-24 w-px bg-gradient-to-b from-gray-200 to-transparent opacity-40"></div>
          <div className="absolute top-0 right-0 h-px w-24 bg-gradient-to-l from-gray-200 to-transparent opacity-40"></div>

          {/* Orbiting elements around center */}
          <div
            className="absolute top-1/2 left-1/2 h-96 w-96 animate-spin rounded-full border border-gray-200 opacity-10"
            style={{ animationDuration: '60s', transform: 'translate(-50%, -50%)' }}
          ></div>
          <div
            className="absolute top-1/2 left-1/2 h-80 w-80 animate-spin rounded-full border border-gray-300 opacity-15"
            style={{ animationDuration: '45s', animationDirection: 'reverse', transform: 'translate(-50%, -50%)' }}
          ></div>
          <div
            className="border-gray-350 absolute top-1/2 left-1/2 h-64 w-64 animate-spin rounded-full border opacity-20"
            style={{ animationDuration: '30s', transform: 'translate(-50%, -50%)' }}
          ></div>

          {/* Scanning beam effect */}
          <div className="absolute top-0 left-0 h-full w-full">
            <div
              className="absolute top-0 left-0 h-full w-1 animate-pulse bg-gradient-to-b from-transparent via-gray-300 to-transparent opacity-10"
              style={{
                animation: 'scanBeam 8s linear infinite',
                transform: 'translateX(-100%)',
              }}
            ></div>
          </div>

          {/* Enhanced Gradient Overlays for Transparency */}
          <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-br from-gray-50/20 via-transparent to-gray-100/10"></div>
          <div className="absolute bottom-0 left-0 h-48 w-full bg-gradient-to-t from-white via-white/90 to-transparent"></div>
          <div className="absolute top-0 left-0 h-48 w-full bg-gradient-to-b from-white via-white/90 to-transparent"></div>

          {/* Floating light effects */}
          <div className="absolute top-1/4 left-1/4 h-24 w-24 animate-pulse rounded-full bg-gray-100/40" style={{ animationDuration: '5s' }}></div>
          <div
            className="absolute top-3/4 right-1/4 h-16 w-16 animate-pulse rounded-full bg-gray-200/50"
            style={{ animationDuration: '4s', animationDelay: '2s' }}
          ></div>
          <div
            className="absolute top-1/2 left-1/6 h-12 w-12 animate-pulse rounded-full bg-gray-200/30"
            style={{ animationDuration: '6s', animationDelay: '1s' }}
          ></div>

          {/* Subtle mesh pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[length:32px_32px] opacity-60"></div>

          {/* Noise texture overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20256%20256%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cfilter%20id%3D%22noiseFilter%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.9%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22/%3E%3C/filter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-2"></div>

          {/* Floating particles */}
          <div className="particle particle-1 opacity-20"></div>
          <div className="particle particle-2 opacity-15"></div>
          <div className="particle particle-3 opacity-25"></div>
          <div className="particle particle-4 opacity-18"></div>
          <div className="particle particle-5 opacity-22"></div>

          {/* Additional animated elements */}
          <div className="absolute top-32 right-16 h-8 w-8 animate-ping border border-gray-300 opacity-15" style={{ animationDuration: '4s' }}></div>
          <div
            className="absolute bottom-40 left-32 h-6 w-6 rotate-45 animate-pulse border border-gray-300 opacity-12"
            style={{ animationDuration: '3s' }}
          ></div>
          <div
            className="absolute top-48 left-16 h-4 w-4 animate-bounce rounded-full bg-gray-300 opacity-18"
            style={{ animationDuration: '5s' }}
          ></div>
        </div>
      </div>
    </div>
  );
}
