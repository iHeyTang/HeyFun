'use client';

import { getAigcModels } from '@/actions/llm';
import { submitGenerationTask } from '@/actions/paintboard';
import { AigcModelSelector } from '@/components/features/aigc-model-selector';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { DynamicForm, extractDefaultValuesFromSchema } from './dynamic-form';
import { imageParamsSchema, videoParamsSchema, t2aParamsSchema, musicParamsSchema, speechToTextParamsSchema } from '@/llm/aigc';
import { useTranslations } from 'next-intl';

/**
 * 为不同的生成类型创建独立的 form schema
 */
const createFormSchema = (paramsSchema: z.ZodType<any>) => {
  return z.object({
    serviceModel: z.string().min(1, 'Please select model'),
    params: paramsSchema,
  });
};

/**
 * 根据生成类型返回对应的参数 schema
 */
const getParamsSchemaByGenerationType = (generationTypes: string[]) => {
  if (generationTypes.includes('text-to-image') || generationTypes.includes('image-to-image')) {
    return imageParamsSchema;
  }
  if (
    generationTypes.includes('text-to-video') ||
    generationTypes.includes('image-to-video') ||
    generationTypes.includes('keyframe-to-video') ||
    generationTypes.includes('video-to-video') ||
    generationTypes.includes('lip-sync')
  ) {
    return videoParamsSchema;
  }
  if (generationTypes.includes('text-to-speech')) {
    return t2aParamsSchema;
  }
  if (generationTypes.includes('speech-to-text')) {
    return speechToTextParamsSchema;
  }
  if (generationTypes.includes('music')) {
    return musicParamsSchema;
  }
  // 默认返回 image schema
  return imageParamsSchema;
};

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

interface PaintBoardFormProps {
  onSubmitSuccess?: (newTask?: Awaited<ReturnType<typeof submitGenerationTask>>['data']) => void;
}

// 基础默认值，不包含动态参数
const baseDefaultValues: any = {
  serviceModel: '',
  params: {},
};

/**
 * PaintBoard 生成表单
 * 支持多种 AIGC 模型的参数配置和任务提交
 */
export function PaintBoardForm({ onSubmitSuccess }: PaintBoardFormProps) {
  const [availableModels, setAvailableModels] = useState<Awaited<ReturnType<typeof getAigcModels>>['data']>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previousModelRef = useRef<string>('');
  const t = useTranslations('paintboard.form');

  // Force form re-render by updating the key
  const [formKey, setFormKey] = useState(0);

  const watchedModelName = useRef<string>('');
  const [currentModelName, setCurrentModelName] = useState<string>('');

  const selectedModel = useMemo(() => {
    return availableModels?.find(model => `${model.name}` === currentModelName);
  }, [availableModels, currentModelName]);

  // 根据选中的模型动态获取对应的 schema
  const currentParamsSchema = useMemo(() => {
    if (!selectedModel) return imageParamsSchema;
    return getParamsSchemaByGenerationType(selectedModel.generationTypes);
  }, [selectedModel]);

  // 获取当前模型的主要生成类型
  const currentGenerationType = useMemo(() => {
    if (!selectedModel) return 'text-to-image';
    const types = selectedModel.generationTypes;

    if (types.includes('text-to-image') || types.includes('image-to-image')) {
      return 'text-to-image';
    }
    if (
      types.includes('text-to-video') ||
      types.includes('image-to-video') ||
      types.includes('keyframe-to-video') ||
      types.includes('video-to-video') ||
      types.includes('lip-sync')
    ) {
      return 'text-to-video';
    }
    if (types.includes('text-to-speech')) {
      return 'text-to-speech';
    }
    if (types.includes('speech-to-text')) {
      return 'speech-to-text';
    }
    if (types.includes('music')) {
      return 'music';
    }
    return 'text-to-image';
  }, [selectedModel]);

  // 动态创建 form schema
  const currentFormSchema = useMemo(() => {
    return createFormSchema(currentParamsSchema);
  }, [currentParamsSchema]);

  // 初始化表单，使用基础默认值
  const form = useForm<FormData>({
    resolver: zodResolver(currentFormSchema),
    defaultValues: baseDefaultValues,
  });

  // Get the JSON schema for the selected model
  const selectedModelSchema = useMemo(() => {
    return selectedModel?.paramsSchema;
  }, [selectedModel]);

  // Initialize and get all service models
  useEffect(() => {
    const loadModels = async () => {
      const result = await getAigcModels({});
      if (result.data) {
        setAvailableModels(result.data);
      }
    };
    loadModels();
  }, []);

  // 处理模型切换
  const handleModelChange = (modelName: string) => {
    if (modelName === previousModelRef.current) return;

    watchedModelName.current = modelName;
    setCurrentModelName(modelName);
    form.setValue('serviceModel', modelName);
    previousModelRef.current = modelName;
  };

  // Reset form when model schema changes
  useEffect(() => {
    if (currentModelName && selectedModelSchema) {
      // 计算新模型的默认值
      const schemaDefaults = extractDefaultValuesFromSchema(selectedModelSchema);
      const newDefaultValues = {
        serviceModel: currentModelName,
        params: schemaDefaults,
      };

      // Reset the entire form with new default values
      form.reset(newDefaultValues);
      // Force form re-render by updating the key
      setFormKey(prev => prev + 1);
    }
  }, [currentModelName, selectedModelSchema]);

  const handleSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      const model = data.serviceModel;

      if (!model) {
        toast.error(t('invalidModel'));
        return;
      }

      // 清理 params：如果 language 是 'auto'，则移除该字段
      const cleanedParams = { ...data.params };
      if (cleanedParams.language === 'auto') {
        delete cleanedParams.language;
      }

      const result = await submitGenerationTask({ model, params: cleanedParams });
      if (result.error) {
        toast.error(`${t('taskSubmitFailed')}: ${result?.error || 'Unknown error'}`);
        return;
      }
      toast.success(t('taskSubmitted'));
      onSubmitSuccess?.(result.data);
    } catch (error) {
      console.error('Failed to submit task:', error);
      toast.error(t('taskSubmitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollArea className="h-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="h-full space-y-6 p-4">
          {/* Model selection */}
          <AigcModelSelector
            models={availableModels || []}
            selectedModel={currentModelName}
            onModelSelect={handleModelChange}
            placeholder={t('selectModel')}
          />

          {/* Dynamic form fields based on selected model's JSON schema */}
          {selectedModelSchema && (
            <DynamicForm
              key={`${currentModelName}-${formKey}`}
              schema={selectedModelSchema}
              form={form}
              provider={selectedModel?.provider}
              modelName={currentModelName}
              generationType={currentGenerationType}
            />
          )}

          {/* Submit button */}
          <Button type="submit" className="w-full" disabled={isSubmitting || !currentModelName}>
            {isSubmitting ? t('submitting') : t('startGeneration')}
          </Button>
        </form>
      </Form>
    </ScrollArea>
  );
}
