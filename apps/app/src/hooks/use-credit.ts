import { getCredit } from '@/actions/credit';
import { useAsync } from './use-async';

export const useCredit = () => {
  const { data, isLoading, refresh } = useAsync(getCredit, [{}], {
    cache: 'credit',
  });
  return { data, isLoading, refresh };
};
