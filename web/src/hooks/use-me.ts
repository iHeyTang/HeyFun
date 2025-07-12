import { getMeApiMeGet, UserInfoResponse } from '@/server';
import { create } from 'zustand';

const useMeStore = create<{
  me: UserInfoResponse | null;
  refreshMe: () => Promise<void>;
}>(set => ({
  me: null,
  refreshMe: async () => {
    const res = await getMeApiMeGet({});
    set({ me: res.data });
  },
}));

export const useMe = () => {
  const { me, refreshMe } = useMeStore();
  return { me, refreshMe };
};
