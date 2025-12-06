/**
 * 动态表单生成组件
 * 基于 JSON Schema 自动生成表单字段
 */

import { Button } from '@/components/ui/button';
import {
  JsonSchemaForm,
  RenderMap,
  CustomFieldRenderer,
  CustomFieldRendererProps,
  extractDefaultValuesFromSchema,
} from '@/components/block/jsonchema-form';
import { JSONSchema } from 'json-schema-to-ts';
import { ChevronDown, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  TextareaRenderer,
  RatioRenderer,
  VoiceRenderer,
  SliderRenderer,
  MultiImageRenderer,
  ImageRenderer,
  VideoRenderer,
  AudioRenderer,
} from './field-renderers';
import { useTranslations } from 'next-intl';

// 导出工具函数
export { extractDefaultValuesFromSchema };

interface DynamicFormProps {
  schema: Exclude<JSONSchema, boolean>;
  form: UseFormReturn<any>;
  fieldPath?: string;
  hideLabel?: boolean;
  provider?: string;
  modelName?: string;
  generationType: string;
}

/**
 * 根据生成类型构建字段渲染映射表
 */
const buildRenderMapByGenerationType = (generationType: string, provider?: string, modelName?: string, t?: (key: string) => string): RenderMap => {
  const map = new Map<string, CustomFieldRenderer>();

  switch (generationType) {
    case 'text-to-image':
    case 'image-to-image':
      // 图片生成相关字段
      map.set('prompt', (renderProps: CustomFieldRendererProps) => {
        return <TextareaRenderer {...renderProps} label={t?.('prompt') || 'prompt'} />;
      });
      map.set('referenceImage', (renderProps: CustomFieldRendererProps) => {
        return <MultiImageRenderer {...renderProps} label={t?.('referenceImage') || 'referenceImage'} />;
      });
      map.set('aspectRatio', (renderProps: CustomFieldRendererProps) => {
        return <RatioRenderer {...renderProps} label={t?.('aspectRatio') || 'aspectRatio'} />;
      });
      break;

    case 'text-to-video':
    case 'image-to-video':
    case 'keyframe-to-video':
    case 'video-to-video':
    case 'lip-sync':
      // 视频生成相关字段
      map.set('prompt', (renderProps: CustomFieldRendererProps) => {
        return <TextareaRenderer {...renderProps} label={t?.('prompt') || 'prompt'} />;
      });
      map.set('firstFrame', (renderProps: CustomFieldRendererProps) => {
        return <ImageRenderer {...renderProps} label={t?.('firstFrame') || 'firstFrame'} />;
      });
      map.set('lastFrame', (renderProps: CustomFieldRendererProps) => {
        return <ImageRenderer {...renderProps} label={t?.('lastFrame') || 'lastFrame'} />;
      });
      map.set('referenceImage', (renderProps: CustomFieldRendererProps) => {
        return <MultiImageRenderer {...renderProps} label={t?.('referenceImage') || 'referenceImage'} />;
      });
      map.set('aspectRatio', (renderProps: CustomFieldRendererProps) => {
        return <RatioRenderer {...renderProps} label={t?.('aspectRatio') || 'aspectRatio'} />;
      });
      // 唇形同步相关字段
      map.set('video', (renderProps: CustomFieldRendererProps) => {
        return <VideoRenderer {...renderProps} label={t?.('video') || 'video'} />;
      });
      map.set('audio', (renderProps: CustomFieldRendererProps) => {
        return <AudioRenderer {...renderProps} label={t?.('audio') || 'audio'} />;
      });
      break;

    case 'text-to-speech':
      // 语音生成相关字段
      map.set('text', (renderProps: CustomFieldRendererProps) => {
        return <TextareaRenderer {...renderProps} label={t?.('text') || 'text'} />;
      });
      map.set('voice_id', (renderProps: CustomFieldRendererProps) => {
        return <VoiceRenderer {...renderProps} label={t?.('voice_id') || 'voice_id'} provider={provider} modelName={modelName} />;
      });
      map.set('speed', (renderProps: CustomFieldRendererProps) => {
        return <SliderRenderer {...renderProps} label={t?.('speed') || 'speed'} />;
      });
      map.set('vol', (renderProps: CustomFieldRendererProps) => {
        return <SliderRenderer {...renderProps} label={t?.('vol') || 'vol'} />;
      });
      map.set('pitch', (renderProps: CustomFieldRendererProps) => {
        return <SliderRenderer {...renderProps} label={t?.('pitch') || 'pitch'} />;
      });
      break;

    case 'music':
      // 音乐生成相关字段
      map.set('prompt', (renderProps: CustomFieldRendererProps) => {
        return <TextareaRenderer {...renderProps} label={t?.('prompt') || 'prompt'} />;
      });
      map.set('lyrics', (renderProps: CustomFieldRendererProps) => {
        return <TextareaRenderer {...renderProps} label={t?.('lyrics') || 'lyrics'} />;
      });
      break;

    default:
      // 默认情况
      break;
  }

  return map;
};

/**
 * 推断主要的生成类型（从 schema 字段名称推断）
 */
const inferGenerationType = (schema: Exclude<JSONSchema, boolean>): string => {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return 'text-to-image';
  }

  const fieldNames = Object.keys(schema.properties);

  // 检查是否有视频/音频相关字段
  if (fieldNames.includes('video') && fieldNames.includes('audio')) {
    return 'lip-sync';
  }
  if (fieldNames.includes('lyrics')) {
    return 'music';
  }
  if (fieldNames.includes('text') && fieldNames.includes('voice_id')) {
    return 'text-to-speech';
  }
  if (fieldNames.includes('firstFrame') || fieldNames.includes('duration') || fieldNames.includes('resolution')) {
    return 'text-to-video';
  }

  // 默认是图片生成
  return 'text-to-image';
};

/**
 * 高级字段折叠渲染器
 */
const AdvancedFieldsRenderer = (props: { schema: any; form: UseFormReturn<any>; fieldPath: string }) => {
  const { schema, form, fieldPath } = props;
  const t = useTranslations('paintboard.form.fields');
  const [isExpanded, setIsExpanded] = useState(false);
  const fieldName = schema.title || fieldPath || 'value';
  const displayLabel = schema.title || t(fieldName) || fieldName;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-2 text-left"
      >
        <span className="text-sm font-medium">{displayLabel}</span>
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {isExpanded && (
        <div className="border-border/30 bg-muted/20 space-y-4 rounded-md border p-3">
          <JsonSchemaForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={true} />
        </div>
      )}
    </div>
  );
};

/**
 * 动态表单组件
 * 基于 JSON Schema 和生成类型自动生成表单字段
 */
export const DynamicForm = (props: DynamicFormProps) => {
  const { schema, form, fieldPath = '', hideLabel = false, provider, modelName, generationType } = props;
  const t = useTranslations('paintboard.form.fields');

  // 构建自定义渲染映射表
  const renderMap = useMemo<RenderMap>(() => {
    return buildRenderMapByGenerationType(generationType, provider, modelName, t);
  }, [generationType, provider, modelName, t]);

  // 渲染上下文
  const renderContext = useMemo(
    () => ({
      provider,
      modelName,
    }),
    [provider, modelName],
  );

  if (!schema) {
    return null;
  }

  // 处理 object 类型，实现特殊布局
  if (schema.type === 'object' && schema.properties) {
    const fields = Object.entries(schema.properties);
    const promptFields: Array<[string, any]> = [];
    const keyframeFields: Array<[string, any]> = [];
    const advancedFields: Array<[string, any]> = [];
    const otherFields: Array<[string, any]> = [];

    // 分离提示词字段、首尾帧字段、高级字段和其他字段
    fields.forEach(([fieldName, fieldSchema]) => {
      if (typeof fieldSchema === 'boolean' || !fieldSchema || typeof fieldSchema !== 'object') {
        return;
      }

      if (fieldName === 'prompt') {
        promptFields.push([fieldName, fieldSchema]);
      } else if (fieldName === 'firstFrame' || fieldName === 'lastFrame') {
        keyframeFields.push([fieldName, fieldSchema]);
      } else if (fieldName === 'advanced') {
        advancedFields.push([fieldName, fieldSchema]);
      } else {
        otherFields.push([fieldName, fieldSchema]);
      }
    });

    const elements: React.ReactNode[] = [];

    // 渲染提示词字段（最上面）
    promptFields.forEach(([fieldName, fieldSchema]) => {
      const currentFieldPath = fieldPath ? `${fieldPath}.${fieldName}` : fieldName;
      elements.push(
        <JsonSchemaForm
          key={fieldName}
          schema={fieldSchema}
          form={form}
          fieldPath={currentFieldPath}
          renderMap={renderMap}
          renderContext={renderContext}
          t={t}
        />,
      );
    });

    // 渲染首尾帧字段（如果存在）
    if (keyframeFields.length > 0) {
      elements.push(
        <div key="keyframes" className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            {keyframeFields.map(([fieldName, fieldSchema]) => {
              const currentFieldPath = fieldPath ? `${fieldPath}.${fieldName}` : fieldName;
              return (
                <JsonSchemaForm
                  key={fieldName}
                  schema={fieldSchema}
                  form={form}
                  fieldPath={currentFieldPath}
                  renderMap={renderMap}
                  renderContext={renderContext}
                  t={t}
                />
              );
            })}
          </div>
        </div>,
      );
    }

    // 渲染其他字段
    otherFields.forEach(([fieldName, fieldSchema]) => {
      const currentFieldPath = fieldPath ? `${fieldPath}.${fieldName}` : fieldName;
      elements.push(
        <JsonSchemaForm
          key={fieldName}
          schema={fieldSchema}
          form={form}
          fieldPath={currentFieldPath}
          renderMap={renderMap}
          renderContext={renderContext}
          t={t}
        />,
      );
    });

    // 渲染高级字段（折叠状态）
    advancedFields.forEach(([fieldName, fieldSchema]) => {
      const currentFieldPath = fieldPath ? `${fieldPath}.${fieldName}` : fieldName;
      elements.push(<AdvancedFieldsRenderer key={fieldName} schema={fieldSchema} form={form} fieldPath={currentFieldPath} />);
    });

    return elements;
  }

  // 其他类型直接使用底层组件
  return (
    <JsonSchemaForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} renderMap={renderMap} renderContext={renderContext} />
  );
};
