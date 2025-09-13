'use client';

import { getAllAigcModelInfos, submitGenerationTask } from '@/actions/paintboard';
import { GenerationSchemaForm, extractDefaultValuesFromSchema } from './generation-schema-form';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';

// Base form schema for model selection
const baseFormSchema = z.object({
  serviceModel: z.string().min(1, 'Please select model'),
  params: z.record(z.any()).optional(),
});

type FormData = z.infer<typeof baseFormSchema>;

interface UnifiedGenerationFormProps {
  onSubmit?: (data: unknown) => void;
}

// 基础默认值，不包含动态参数
const baseDefaultValues: FormData = {
  serviceModel: '',
  params: {},
};

export function UnifiedGenerationForm({ onSubmit }: UnifiedGenerationFormProps) {
  const [availableModels, setAvailableModels] = useState<Awaited<ReturnType<typeof getAllAigcModelInfos>>['data']>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previousModelRef = useRef<string>('');

  // Force form re-render by updating the key
  const [formKey, setFormKey] = useState(0);

  // 初始化表单，使用基础默认值
  const form = useForm<FormData>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: baseDefaultValues,
  });

  const watchedModelName = form.watch('serviceModel');

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => `${model.name}` === watchedModelName);
  }, [availableModels, watchedModelName]);

  // Get the JSON schema for the selected model
  const selectedModelSchema = useMemo(() => {
    return selectedModel?.paramsSchema;
  }, [selectedModel]);

  // Initialize and get all service models
  useEffect(() => {
    const loadModels = async () => {
      const result = await getAllAigcModelInfos({});
      if (result.data) {
        setAvailableModels(result.data);
      }
    };
    loadModels();
  }, []);

  // Reset form when model changes
  useEffect(() => {
    if (watchedModelName && watchedModelName !== previousModelRef.current && selectedModelSchema) {
      // 计算新模型的默认值
      const schemaDefaults = extractDefaultValuesFromSchema(selectedModelSchema as any);
      const newDefaultValues = {
        serviceModel: watchedModelName,
        params: schemaDefaults,
      };
      console.log('New default values:', newDefaultValues);

      // Reset the entire form with new default values
      form.reset(newDefaultValues);
      // Force form re-render by updating the key
      setFormKey(prev => prev + 1);
      // Update the previous model reference
      previousModelRef.current = watchedModelName;
    }
  }, [form, watchedModelName, selectedModelSchema]);

  const handleSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      const model = data.serviceModel;

      if (!model) {
        toast.error('Invalid service or model information');
        return;
      }

      // Use the params from the form data
      const formData = {
        ...data.params,
      };

      const result = await submitGenerationTask({ model, params: formData });

      if (result.data) {
        if (result.data.success) {
          toast.success('Task submitted successfully');
          onSubmit?.(result);
        } else {
          toast.error('Task submission failed');
        }
      } else {
        toast.error(`Task submission failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to submit task:', error);
      toast.error('Failed to submit task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollArea className="h-full p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="h-full space-y-6">
          {/* Model selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select onValueChange={value => form.setValue('serviceModel', value)} value={watchedModelName}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels?.map(model => (
                  <SelectItem key={`${model.name}`} value={`${model.name}`}>
                    <div>{model.displayName}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic form fields based on selected model's JSON schema */}
          {selectedModelSchema && <GenerationSchemaForm key={`${watchedModelName}-${formKey}`} schema={selectedModelSchema as any} form={form} />}

          {/* Submit button */}
          <Button type="submit" className="w-full" disabled={isSubmitting || !watchedModelName}>
            {isSubmitting ? 'Submitting...' : 'Start Generation'}
          </Button>
        </form>
      </Form>
    </ScrollArea>
  );
}
