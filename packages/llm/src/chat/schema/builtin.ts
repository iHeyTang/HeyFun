import { z } from 'zod';
import { BaseProviderConfigSchema } from './base';

export const builtinConfigSchema = z.object({
  // 内置provider不需要用户配置，通过环境变量自动配置
});

export class BuiltinProviderConfigSchema extends BaseProviderConfigSchema<z.infer<typeof builtinConfigSchema>> {
  readonly schema = builtinConfigSchema;
  readonly maskSensitiveKeys: string[] = [];
  readonly defaultValues = {};
}