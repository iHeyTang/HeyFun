'use client';

import { Badge } from '@/components/ui/badge';
import { useCredit } from '@/hooks/use-credit';
import { Sparkles } from 'lucide-react';

export const CreditBadge = () => {
  const { data, isLoading, refresh } = useCredit();
  return (
    <Badge className="cursor-pointer px-2 transition hover:scale-101" onClick={refresh}>
      <Sparkles /> {isLoading ? 'Loading...' : (data?.data ? data.data / 1000 : 0).toFixed(2)}
    </Badge>
  );
};
