'use client';

import { ProviderSidebar } from './components/provider-sidebar';

export default function ConfigLlm({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full">
      <ProviderSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
