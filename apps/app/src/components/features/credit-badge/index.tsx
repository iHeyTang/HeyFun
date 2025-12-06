'use client';

import { Badge } from '@/components/ui/badge';
import { useCredit } from '@/hooks/use-credit';
import { Sparkles } from 'lucide-react';

export const CreditBadge = () => {
  const { data, isLoading, refresh } = useCredit();
  return (
    <Badge className="hover:scale-101 cursor-pointer px-2 transition" onClick={refresh}>
      <Sparkles /> {isLoading ? 'Loading...' : (data?.data ? data.data / 1000 : 0).toFixed(3)}
    </Badge>
  );
};
