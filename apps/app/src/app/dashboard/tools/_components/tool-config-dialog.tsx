import { installTool } from '@/actions/tools';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { ToolSchemas } from '@prisma/client';
import { JSONSchema } from 'json-schema-to-ts';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

interface ToolConfigDialogProps {
  onSuccess?: () => void;
}

export interface ToolConfigDialogRef {
  showConfig: (tool: ToolSchemas) => void;
}

export const ToolConfigDialog = forwardRef<ToolConfigDialogRef, ToolConfigDialogProps>(({ onSuccess }, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [tool, setTool] = useState<ToolSchemas>();
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    showConfig: tool => {
      setTool(tool);
      setOpen(true);
    },
  }));

  const envFormSchema = generateZodSchema(tool?.envSchema as any);
  const queryFormSchema = generateZodSchema(tool?.querySchema as any);
  const headersFormSchema = generateZodSchema(tool?.headersSchema as any);

  const combinedSchema = z.object({
    env: envFormSchema,
    query: queryFormSchema,
    headers: headersFormSchema,
  });

  const form = useForm<z.infer<typeof combinedSchema>>({
    resolver: zodResolver(combinedSchema),
    defaultValues: {
      env: generateDefaultValues(tool?.envSchema),
      query: generateDefaultValues(tool?.querySchema),
      headers: generateDefaultValues(tool?.headersSchema),
    },
  });

  const onSubmit = async (values: z.infer<typeof combinedSchema>) => {
    try {
      setIsLoading(true);
      await installTool({
        toolId: tool!.id,
        env: values.env,
        query: values.query,
        headers: values.headers,
      });
      toast.success('Install success', {
        description: 'Tool config saved',
      });
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Install failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!tool) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install {tool.name}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Environment Configuration */}
              {tool.envSchema.properties && Object.keys(tool.envSchema.properties).length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">Environment Variables</h4>
                  {Object.entries(tool.envSchema.properties).map(([key, value]: [string, any]) => (
                    <FormField
                      key={`env.${key}`}
                      control={form.control}
                      name={`env.${key}` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {value.title || key}
                            {value.description && <FormDescription>{value.description}</FormDescription>}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type={value.type === 'number' ? 'number' : 'text'}
                              placeholder={value.description}
                              {...field}
                              value={String(field.value ?? (value.type === 'number' ? 0 : ''))}
                              onChange={e => {
                                const val = value.type === 'number' ? (e.target.value === '' ? 0 : Number(e.target.value)) : e.target.value;
                                field.onChange(val);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Query Parameters Configuration */}
              {tool.querySchema &&
                typeof tool.querySchema === 'object' &&
                'properties' in tool.querySchema &&
                tool.querySchema.properties &&
                Object.keys(tool.querySchema.properties).length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Query Parameters</h4>
                    {Object.entries(tool.querySchema.properties).map(([key, value]: [string, any]) => (
                      <FormField
                        key={`query.${key}`}
                        control={form.control}
                        name={`query.${key}` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {value.title || key}
                              {value.description && <FormDescription>{value.description}</FormDescription>}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type={value.type === 'number' ? 'number' : 'text'}
                                placeholder={value.description}
                                {...field}
                                value={String(field.value ?? (value.type === 'number' ? 0 : ''))}
                                onChange={e => {
                                  const val = value.type === 'number' ? (e.target.value === '' ? 0 : Number(e.target.value)) : e.target.value;
                                  field.onChange(val);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                )}

              {/* Headers Configuration */}
              {tool.headersSchema &&
                typeof tool.headersSchema === 'object' &&
                'properties' in tool.headersSchema &&
                tool.headersSchema.properties &&
                Object.keys(tool.headersSchema.properties).length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Headers</h4>
                    {Object.entries(tool.headersSchema.properties).map(([key, value]: [string, any]) => (
                      <FormField
                        key={`headers.${key}`}
                        control={form.control}
                        name={`headers.${key}` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {value.title || key}
                              {value.description && <FormDescription>{value.description}</FormDescription>}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type={value.type === 'number' ? 'number' : 'text'}
                                placeholder={value.description}
                                {...field}
                                value={String(field.value ?? (value.type === 'number' ? 0 : ''))}
                                onChange={e => {
                                  const val = value.type === 'number' ? (e.target.value === '' ? 0 : Number(e.target.value)) : e.target.value;
                                  field.onChange(val);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                )}
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Installing...' : 'Install Tool'}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
});

ToolConfigDialog.displayName = 'ToolConfigDialog';

const generateZodSchema = (schema: Exclude<JSONSchema, boolean> | undefined) => {
  const zodSchema: Record<string, any> = {};
  if (!schema || typeof schema === 'boolean') {
    return z.object({});
  }
  if (schema?.properties) {
    Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
      let zodType;
      switch (value.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        default:
          zodType = z.string();
      }

      if (value.required) {
        zodSchema[key] = zodType;
      } else {
        zodSchema[key] = zodType.optional();
      }
    });
  }

  return z.object(zodSchema);
};

const generateDefaultValues = (schema?: any) => {
  const defaultValues: Record<string, any> = {};
  if (!schema?.properties) {
    return defaultValues;
  }

  Object.entries(schema.properties).forEach(([key, _propSchema]) => {
    const propSchema = _propSchema as PrismaJson.JsonSchema;
    if (typeof propSchema === 'boolean') {
      defaultValues[key] = false;
      return;
    }

    if (propSchema.default) {
      defaultValues[key] = propSchema.default;
      return;
    }

    switch (propSchema.type) {
      case 'string':
        defaultValues[key] = '';
        break;
      case 'number':
      case 'integer':
        defaultValues[key] = 0;
        break;
      case 'boolean':
        defaultValues[key] = false;
        break;
      case 'array':
        defaultValues[key] = [];
        break;
      case 'object':
        defaultValues[key] = {};
        break;
      case 'null':
      default:
        defaultValues[key] = null;
    }
  });
  return defaultValues;
};
