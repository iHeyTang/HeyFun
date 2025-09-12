'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import storage from '@/lib/server/storage';

export const getSignedUploadUrl = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ filePath: string }>) => {
  return await storage.getSignedUploadUrl(`${orgId}/${args.filePath}`, { expiresIn: 3600 });
});

export const getSignedUrl = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ filePath: string }>) => {
  const key = args.filePath.startsWith(orgId) ? args.filePath : `${orgId}/${args.filePath}`;
  return await storage.getSignedUrl(key, { expiresIn: 3600 });
});
