/**
 * 自定义字段渲染器集合
 * 用于 PaintBoard 表单的各种特殊字段渲染
 */

import { ImageUpload, MultiImageUpload, VideoUpload, AudioUpload } from '@/components/block/image-upload';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { RatioIcon } from '@/components/block/ratio-icon';
import { getAigcVoiceList, getAigcSupportedLanguages } from '@/actions/llm';
import { CustomFieldRendererProps } from '@/components/block/jsonchema-form';
import { useState, useEffect } from 'react';

// Voice 类型定义
type Voice = NonNullable<Awaited<ReturnType<typeof getAigcVoiceList>>['data']>[number];

// Language 类型定义
type Language = NonNullable<Awaited<ReturnType<typeof getAigcSupportedLanguages>>['data']>[number];

// ==================== Input 渲染器 ====================
export const InputRenderer = (props: CustomFieldRendererProps & { label: string }) => {
  const { form, formFieldPath, label, hideLabel } = props;

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem>
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input placeholder={`输入${label}`} {...formField} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// ==================== Textarea 渲染器 ====================
export const TextareaRenderer = (props: CustomFieldRendererProps & { label: string }) => {
  const { form, formFieldPath, label, hideLabel } = props;

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem>
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Textarea placeholder={`输入${label}`} {...formField} className="min-h-[100px]" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// ==================== 比例选择渲染器 ====================
export const RatioRenderer = (props: CustomFieldRendererProps & { label: string }) => {
  const { schema, form, formFieldPath, label, hideLabel } = props;

  if (!schema.enum || !Array.isArray(schema.enum)) {
    return null;
  }

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <div className="grid grid-cols-[repeat(auto-fit,48px)] justify-start gap-2">
              {(schema.enum as string[]).map((ratio: string) => (
                <Button
                  key={ratio}
                  type="button"
                  variant={field.value === ratio ? 'default' : 'secondary'}
                  onClick={() => field.onChange(ratio)}
                  className="h-16 w-12 justify-self-center px-2 py-3"
                >
                  <div className="flex flex-col items-center gap-1">
                    <RatioIcon ratio={ratio} />
                    <span className="text-xs">{ratio}</span>
                  </div>
                </Button>
              ))}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// ==================== 声音选择渲染器 ====================
export const VoiceRenderer = (props: CustomFieldRendererProps & { label: string; provider?: string; modelName?: string }) => {
  const { form, formFieldPath, label, hideLabel, provider, modelName } = props;
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = async () => {
      if (!modelName || !provider) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getAigcVoiceList({ provider, modelName });
        if (result.error) {
          setError(result.error);
        } else {
          setVoices(result.data || []);
        }
      } catch (err) {
        console.error('Failed to load voices:', err);
        setError(err instanceof Error ? err.message : 'Failed to load voices');
      } finally {
        setLoading(false);
      }
    };

    loadVoices();
  }, [provider, modelName]);

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <Select onValueChange={formField.onChange} value={formField.value}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loading ? '加载中...' : error ? '加载失败' : `选择${label}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {voices.map(voice => (
                <SelectItem key={voice.id} value={voice.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{voice.name}</span>
                    <span className="text-muted-foreground text-xs">{voice.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// ==================== 滑块渲染器 ====================
export const SliderRenderer = (props: CustomFieldRendererProps & { label: string; unit?: string }) => {
  const { schema, form, formFieldPath, label, hideLabel, unit = '' } = props;

  const hasRange = schema.minimum !== undefined || schema.maximum !== undefined;
  const min = schema.minimum ?? 0;
  const max = schema.maximum ?? 100;
  const step = schema.multipleOf ?? 1;
  const isFixedValue = min === max;

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <FormControl>
            {hasRange && !isFixedValue ? (
              <div className="space-y-3">
                <Slider
                  value={[formField.value ?? min]}
                  onValueChange={value => formField.onChange(value[0])}
                  min={min}
                  max={max}
                  step={step}
                  className="w-full"
                />
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">
                    {min}
                    {unit ? ` ${unit}` : ''}
                  </span>
                  <span className="bg-primary text-primary-foreground rounded px-2 py-1 text-sm font-semibold">
                    {formField.value ?? min}
                    {unit ? ` ${unit}` : ''}
                  </span>
                  <span className="text-muted-foreground">
                    {max}
                    {unit ? ` ${unit}` : ''}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Input
                  type="number"
                  placeholder={`输入${label}`}
                  value={isFixedValue ? min : formField.value}
                  onChange={e => {
                    if (!isFixedValue) {
                      const value = e.target.value;
                      formField.onChange(value === '' ? undefined : Number(value));
                    }
                  }}
                  readOnly={isFixedValue}
                  className={isFixedValue ? 'bg-muted/50 cursor-not-allowed pr-8' : unit ? 'pr-8' : ''}
                />
                {unit && <div className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">{unit}</div>}
              </div>
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// ==================== 多图片上传渲染器 ====================
export const MultiImageRenderer = (props: CustomFieldRendererProps & { label: string }) => {
  const { form, formFieldPath, label, hideLabel } = props;

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <MultiImageUpload
              value={formField.value || []}
              onChange={formField.onChange}
              accept="image/*"
              maxSize={10 * 1024 * 1024} // 10MB
              maxFiles={10}
              uploadPath="paintboard"
              itemSize="sm"
              gridCols={4}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// ==================== 单图片上传渲染器 ====================
export const ImageRenderer = (props: CustomFieldRendererProps & { label: string }) => {
  const { form, formFieldPath, label, hideLabel } = props;

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <ImageUpload
              value={formField.value ? String(formField.value) : ''}
              onChange={formField.onChange}
              accept="image/*"
              maxSize={10 * 1024 * 1024} // 10MB
              uploadPath="paintboard"
              size="sm"
              showPreview={true}
              className="h-24 w-24"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// ==================== 视频上传渲染器 ====================
export const VideoRenderer = (props: CustomFieldRendererProps & { label: string }) => {
  const { form, formFieldPath, label, hideLabel } = props;

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <VideoUpload
              value={formField.value ? String(formField.value) : ''}
              onChange={formField.onChange}
              accept="video/*"
              maxSize={100 * 1024 * 1024} // 100MB
              uploadPath="paintboard"
              showPreview={true}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// ==================== 音频上传渲染器 ====================
export const AudioRenderer = (props: CustomFieldRendererProps & { label: string }) => {
  const { form, formFieldPath, label, hideLabel } = props;

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <AudioUpload
              value={formField.value ? String(formField.value) : ''}
              onChange={formField.onChange}
              accept="audio/*"
              maxSize={50 * 1024 * 1024} // 50MB
              uploadPath="paintboard"
              showPreview={true}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// ==================== 语言选择渲染器 ====================
export const LanguageRenderer = (props: CustomFieldRendererProps & { label: string; modelName?: string }) => {
  const { form, formFieldPath, label, hideLabel, modelName } = props;
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLanguages = async () => {
      if (!modelName) {
        // 如果没有模型名称，使用默认语言列表
        setLanguages([
          { code: 'auto', name: '自动检测' },
          { code: 'zh', name: '中文' },
          { code: 'en', name: 'English' },
          { code: 'ja', name: '日本語' },
          { code: 'ko', name: '한국어' },
        ]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getAigcSupportedLanguages({ modelName });
        if (result.error) {
          setError(result.error);
          // 如果获取失败，使用默认语言列表
          setLanguages([
            { code: 'auto', name: '自动检测' },
            { code: 'zh', name: '中文' },
            { code: 'en', name: 'English' },
            { code: 'ja', name: '日本語' },
            { code: 'ko', name: '한국어' },
          ]);
        } else {
          const langList = result.data || [];
          if (langList.length > 0) {
            // 添加"自动检测"选项
            setLanguages([{ code: 'auto', name: '自动检测' }, ...langList]);
          } else {
            // 如果没有返回语言列表，使用默认列表
            setLanguages([
              { code: 'auto', name: '自动检测' },
              { code: 'zh', name: '中文' },
              { code: 'en', name: 'English' },
              { code: 'ja', name: '日本語' },
              { code: 'ko', name: '한국어' },
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load languages:', err);
        setError(err instanceof Error ? err.message : 'Failed to load languages');
        // 使用默认语言列表
        setLanguages([
          { code: 'auto', name: '自动检测' },
          { code: 'zh', name: '中文' },
          { code: 'en', name: 'English' },
          { code: 'ja', name: '日本語' },
          { code: 'ko', name: '한국어' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadLanguages();
  }, [modelName]);

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{label}</FormLabel>}
          <Select onValueChange={formField.onChange} value={formField.value || 'auto'}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loading ? '加载中...' : error ? '加载失败' : `选择${label}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {languages.map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name} ({lang.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
