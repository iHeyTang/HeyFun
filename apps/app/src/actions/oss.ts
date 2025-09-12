'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import storage from '@/lib/server/storage';
import { nanoid } from 'nanoid';

export const getSignedUploadUrl = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ extension: string }>) => {
  const key = `${orgId}/${Date.now()}_${nanoid(8)}${args.extension}`;
  const url = await storage.getSignedUploadUrl(`${orgId}/${key}`, { expiresIn: 3600 });
  return { fileKey: `${orgId}/${key}`, uploadUrl: url };
});

export const getSignedUrl = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ filePath: string }>) => {
  const key = args.filePath.startsWith(orgId) ? args.filePath : `${orgId}/${args.filePath}`;
  return await storage.getSignedUrl(key, { expiresIn: 3600 });
});
