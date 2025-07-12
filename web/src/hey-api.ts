import type { CreateClientConfig } from './server/client.gen';

export const createClientConfig: CreateClientConfig = () => ({
  auth: async () => {
    return `Bearer ${document.cookie}`;
  },
});
