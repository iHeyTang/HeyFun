'use client';

import { getAllAigcModelInfos, submitGenerationTask } from '@/actions/paintboard';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AigcModelSelector } from '@/components/features/aigc-model-selector';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { GenerationSchemaForm, extractDefaultValuesFromSchema } from './generation-schema-form';

// Base form schema for model selection
const baseFormSchema = z.object({
  serviceModel: z.string().min(1, 'Please select model'),
  params: z.record(z.any()).optional(),
});

type FormData = z.infer<typeof baseFormSchema>;

interface UnifiedGenerationFormProps {
  onSubmitSuccess?: () => void;
}

// 基础默认值，不包含动态参数
const baseDefaultValues: FormData = {
  serviceModel: '',
  params: {},
};

export function UnifiedGenerationForm({ onSubmitSuccess }: UnifiedGenerationFormProps) {
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

      const result = await submitGenerationTask({ model, params: data.params });
      if (result.error) {
        toast.error(`Task submission failed: ${result?.error || 'Unknown error'}`);
        return;
      }
      toast.success('Task submitted successfully');
      onSubmitSuccess?.();
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
          <AigcModelSelector
            models={
              availableModels?.map(model => ({
                name: model.name,
                displayName: model.displayName,
                description: model.description,
                generationTypes: model.generationTypes,
              })) || []
            }
            selectedModel={watchedModelName}
            onModelSelect={value => form.setValue('serviceModel', value)}
            placeholder="选择模型"
          />

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
