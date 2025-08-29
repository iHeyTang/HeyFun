'use client';

import { AigcProviderSidebar } from './sidebar';

export default function ConfigAigc({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full">
      <AigcProviderSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
