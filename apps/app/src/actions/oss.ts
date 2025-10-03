'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import storage from '@/lib/server/storage';
import { nanoid } from 'nanoid';

export const getSignedUploadUrl = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ path?: string; extension: string }>) => {
  const key = `${orgId}${args.path ? `/${args.path}` : ''}/${Date.now()}_${nanoid(8)}.${args.extension}`;
  const url = await storage.getSignedUploadUrl(key, { expiresIn: 3600 });
  return { fileKey: key, uploadUrl: url };
});

export const getSignedUrl = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ fileKey: string }>) => {
  const key = args.fileKey.startsWith(orgId) ? args.fileKey : `${orgId}/${args.fileKey}`;
  return await storage.getSignedUrl(key, { expiresIn: 3600 });
});

export const getSignedUrls = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ fileKeys: string[] }>) => {
  return await Promise.all(args.fileKeys.map(key => storage.getSignedUrl(key.startsWith(orgId) ? key : `${orgId}/${key}`, { expiresIn: 3600 })));
});
