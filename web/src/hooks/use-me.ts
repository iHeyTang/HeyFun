import { create } from 'zustand';

const useMeStore = create<{
  me: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    isRoot: boolean;
  } | null;
  refreshMe: () => Promise<void>;
}>(set => ({
  me: null,
  refreshMe: async () => {
    const res = await fetch('/api/me', {}).then(res => res.json());
    set({ me: res });
  },
}));

export const useMe = () => {
  const { me, refreshMe } = useMeStore();
  return { me, refreshMe };
};
