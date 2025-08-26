'use client';

import { getModelProviderConfig, testModelProviderConnection, updateModelProviderConfig } from '@/actions/llm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { InputPassword } from '@/components/ui/input-passoword';
import { Switch } from '@/components/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { providerConfigSchemas } from '@repo/llm/chat';
import { Loader2, Save, Wifi, WifiOff } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z, ZodBoolean, ZodNumber, ZodString } from 'zod';
import { useProvidersStore } from '../../store';

interface ConnectionStatus {
  isChecking: boolean;
  isConnected: boolean;
  error?: string;
  lastChecked?: Date;
}

export default function ProviderConfigPanel() {
  const params = useParams();
  const providerId = params.providerId as string;
  const providerInfo = useProvidersStore(state => state.getProviderInfo(providerId));
  const providerConfig = useProvidersStore(state => state.getProviderConfig(providerId));
  const [configSchema, setConfigSchema] = useState<z.ZodObject<Record<string, z.ZodTypeAny>>>(z.object({}));

  const form = useForm<z.infer<typeof configSchema>>({
    resolver: zodResolver(configSchema),
    defaultValues: providerConfigSchemas[providerId as keyof typeof providerConfigSchemas].defaultValues,
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isChecking: false,
    isConnected: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const testConnection = useCallback(
    async (config: z.infer<typeof configSchema>) => {
      setConnectionStatus(prev => ({ ...prev, isChecking: true }));

      try {
        // Test connection
        const result = await testModelProviderConnection({ provider: providerId });

        setConnectionStatus({
          isChecking: false,
          isConnected: result.data?.success ?? false,
          error: result.data?.error ?? undefined,
          lastChecked: new Date(),
        });
      } catch (error) {
        setConnectionStatus({
          isChecking: false,
          isConnected: false,
          error: error instanceof Error ? error.message : 'Test failed',
          lastChecked: new Date(),
        });
      }
    },
    [providerId],
  );

  useEffect(() => {
    setConfigSchema(providerConfigSchemas[providerInfo?.provider as keyof typeof providerConfigSchemas].schema);

    getModelProviderConfig({ provider: providerId }).then(p => {
      if (!p.data) {
        return;
      }
      form.reset(p.data);
      testConnection(p.data);
    });
  }, [providerId, form, providerConfig, testConnection]);

  useEffect(() => {
    if (!form.formState.isDirty && !connectionStatus.lastChecked && configSchema.safeParse(form.getValues()).success) {
      // Delay testing to avoid frequent requests
      const timer = setTimeout(() => {
        testConnection(form.getValues());
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [form.formState.isDirty, connectionStatus]);

  const retestConnection = () => {
    testConnection(form.getValues());
  };

  const onSubmit = async (data: z.infer<typeof configSchema>) => {
    const validation = configSchema.safeParse(data);
    if (!validation.success) {
      toast.error(validation.error.message);
      return;
    }

    try {
      setIsSaving(true);
      await updateModelProviderConfig({ provider: providerId, config: data });
      toast.success('Configuration saved successfully');

      // Auto test connection after saving
      setTimeout(() => {
        testConnection(data);
      }, 500);
    } catch (error) {
      toast.error('Failed to save configuration');
      console.error('Failed to save configuration:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Title bar */}
      <div className="mb-3">
        <h2 className="text-2xl leading-none font-bold">{providerInfo?.displayName}</h2>
        <div className="mt-2 flex items-center">
          <ProviderConnectionStatus connectionStatus={connectionStatus} onClick={() => retestConnection()} />
        </div>
      </div>

      <div className="space-y-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {Object.entries((configSchema as z.ZodObject<Record<string, z.ZodTypeAny>>).shape).map(([key, value]) => {
              return (
                <FormField
                  key={key}
                  control={form.control}
                  name={key as any}
                  rules={{ required: value.isOptional() ? false : true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <span>{key}</span>
                        {!value.isOptional() ? <span className="text-destructive/50 text-xs">*</span> : null}
                      </FormLabel>
                      <FormControl>
                        {value._def.typeName === ZodString.name ? (
                          providerConfigSchemas[providerId as keyof typeof providerConfigSchemas].maskSensitiveKeys.includes(key) ? (
                            <InputPassword {...field} showPasswordToggle={true} />
                          ) : (
                            <Input {...field} />
                          )
                        ) : value._def.typeName === ZodNumber.name ? (
                          <Input type="number" {...field} />
                        ) : value._def.typeName === ZodBoolean.name ? (
                          <Switch {...field} />
                        ) : null}
                      </FormControl>
                    </FormItem>
                  )}
                />
              );
            })}
            <Button type="submit" variant="secondary" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

const ProviderConnectionStatus = ({ connectionStatus, onClick }: { connectionStatus: ConnectionStatus; onClick?: () => void }) => {
  if (!connectionStatus.lastChecked) {
    return (
      <Badge variant="outline" className="cursor-pointer rounded-full border-none bg-blue-50 px-2 py-1 text-xs font-normal text-blue-600 shadow-none">
        <WifiOff className="mr-1 h-3 w-3" />
        No connection inspection yet, the configuration is not set yet.
      </Badge>
    );
  }
  if (connectionStatus.isChecking) {
    return (
      <Badge
        variant="outline"
        className="cursor-pointer rounded-full border-none bg-blue-50 px-2 py-1 text-xs font-normal text-blue-600 shadow-none"
        onClick={onClick}
        title="Testing"
      >
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Testing
      </Badge>
    );
  }

  if (connectionStatus.isConnected) {
    return (
      <Badge
        variant="outline"
        className="cursor-pointer rounded-full border-none bg-green-50 px-2 py-1 text-xs font-normal text-green-500 shadow-none"
        onClick={onClick}
        title="Connected"
      >
        <Wifi className="mr-1 h-3 w-3" />
        Connected
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="cursor-pointer rounded-full border-none bg-red-50 px-2 py-1 text-xs font-normal text-red-500 shadow-none"
      onClick={onClick}
      title="Connection Failed"
    >
      <WifiOff className="mr-1 h-3 w-3" />
      Connection Failed: {connectionStatus.error}
    </Badge>
  );
};
