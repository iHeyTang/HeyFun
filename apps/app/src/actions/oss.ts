'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import storage from '@/lib/server/storage';
import { nanoid } from 'nanoid';

export const getSignedUploadUrl = withUserAuth(
  'oss/getSignedUploadUrl',
  async ({ orgId, args }: AuthWrapperContext<{ path?: string; extension: string }>) => {
    const key = `${orgId}${args.path ? `/${args.path}` : ''}/${Date.now()}_${nanoid(8)}.${args.extension}`;
    const url = await storage.getSignedUploadUrl(key, { expiresIn: 3600 });
    return { fileKey: key, uploadUrl: url };
  },
);

export const getSignedUrl = withUserAuth('oss/getSignedUrl', async ({ orgId, args }: AuthWrapperContext<{ fileKey: string }>) => {
  const isFullKey = args.fileKey.startsWith(orgId) || args.fileKey.startsWith(`system/`);
  const key = isFullKey ? args.fileKey : `${orgId}/${args.fileKey}`;
  return await storage.getSignedUrl(key, { expiresIn: 3600 });
});

export const getSignedUrls = withUserAuth('oss/getSignedUrls', async ({ orgId, args }: AuthWrapperContext<{ fileKeys: string[] }>) => {
  const isFullKey = args.fileKeys.some(key => key.startsWith(orgId) || key.startsWith(`system/`));
  const keys = isFullKey ? args.fileKeys : args.fileKeys.map(key => `${orgId}/${key}`);
  return await Promise.all(keys.map(key => storage.getSignedUrl(key, { expiresIn: 3600 })));
});
