'use client';

import { getAigcProviderInfo, getAigcProviderConfig, updateAigcProviderConfig } from '@/actions/aigc';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { volcengineArkServiceConfigSchema } from '@repo/llm/aigc';
import { volcengineJimengServiceConfigSchema } from '@repo/llm/aigc';
import { dashscopeWanServiceConfigSchema } from '@repo/llm/aigc';

// 根据provider获取对应的schema
const getConfigSchema = (provider: string) => {
  switch (provider) {
    case 'doubao':
      return volcengineArkServiceConfigSchema;
    case 'jimeng':
      return volcengineJimengServiceConfigSchema;
    case 'wan':
      return dashscopeWanServiceConfigSchema;
    default:
      return z.object({});
  }
};

// 根据provider获取默认值
const getDefaultValues = (provider: string) => {
  switch (provider) {
    case 'doubao':
      return { apiKey: '' };
    case 'jimeng':
      return { accessKeyId: '', secretAccessKey: '' };
    case 'wan':
      return { apiKey: '' };
    default:
      return {};
  }
};

// 根据provider获取字段配置
const getFieldConfig = (provider: string) => {
  switch (provider) {
    case 'doubao':
      return [
        {
          name: 'apiKey',
          label: 'API Key',
          description: '火山引擎方舟 AI的API Key',
          type: 'password' as const,
        },
      ];
    case 'jimeng':
      return [
        {
          name: 'accessKeyId',
          label: 'Access Key ID',
          description: '火山引擎即梦AI的Access Key ID',
          type: 'text' as const,
        },
        {
          name: 'secretAccessKey',
          label: 'Secret Access Key',
          description: '火山引擎即梦AI的Secret Access Key',
          type: 'password' as const,
        },
      ];
    case 'wan':
      return [
        {
          name: 'apiKey',
          label: 'API Key',
          description: '阿里云万相AI的API Key',
          type: 'password' as const,
        },
      ];
    default:
      return [];
  }
};

export default function AigcProviderConfigPanel() {
  const params = useParams();
  const providerId = params.providerId as string;

  const [providerInfo, setProviderInfo] = useState<Awaited<ReturnType<typeof getAigcProviderInfo>>['data']>();

  const configSchema = getConfigSchema(providerId);
  const defaultValues = getDefaultValues(providerId);
  const fieldConfig = getFieldConfig(providerId);

  const form = useForm<any>({
    resolver: zodResolver(configSchema),
    defaultValues,
  });

  useEffect(() => {
    getAigcProviderInfo({ provider: providerId }).then(p => {
      if (p) {
        setProviderInfo(p.data);
      }
    });

    getAigcProviderConfig({ provider: providerId }).then(p => {
      if (p) {
        form.reset(p);
      }
    });
  }, [providerId, form]);

  const onSubmit = async (data: z.infer<typeof configSchema>) => {
    try {
      const result = await updateAigcProviderConfig({ provider: providerId, config: data });

      if (result) {
        toast.success('配置已保存');
      } else {
        toast.error('保存失败');
      }
    } catch (error) {
      toast.error('保存失败');
    }
  };

  if (!providerInfo) {
    return <div />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Title bar */}
      <div className="flex-shrink-0 p-6">
        <div className="flex items-baseline gap-4">
          <div className="flex flex-1 items-center">
            <h2 className="text-2xl leading-none font-bold">{providerInfo.displayName} 配置</h2>
          </div>
        </div>
        <div className="text-muted-foreground mt-2 text-sm">{providerInfo.description}</div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-6 pr-4">
        {/* Configuration Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {fieldConfig.map(field => (
              <FormField
                key={field.name}
                control={form.control}
                name={field.name}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>{field.label}</FormLabel>
                    <FormControl>
                      <Input type={field.type} placeholder={`请输入${field.label}`} {...formField} />
                    </FormControl>
                    <FormDescription>{field.description}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <div className="flex items-center justify-between">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存配置'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
