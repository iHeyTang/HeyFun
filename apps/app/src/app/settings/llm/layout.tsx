'use client';

import { useLLM } from '@/hooks/use-llm';
import { ProviderSidebar } from './components/provider-sidebar';
import { useEffect } from 'react';

export default function ConfigLlm({ children }: { children: React.ReactNode }) {
  const { initiate } = useLLM();

  useEffect(() => {
    initiate();
  }, [initiate]);

  return (
    <div className="flex h-full w-full">
      <ProviderSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
