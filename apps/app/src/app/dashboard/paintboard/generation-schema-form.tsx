import { ImageUpload, MultiImageUpload } from '@/components/block/image-upload';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getAigcVoiceList } from '@/actions/llm';
import { JSONSchema } from 'json-schema-to-ts';
import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';

// Voice 类型定义
type Voice = NonNullable<Awaited<ReturnType<typeof getAigcVoiceList>>['data']>[number];

// 自定义矩形图标组件，根据比例动态调整宽高
const RatioIcon = ({ ratio }: { ratio: string }) => {
  // 解析比例字符串，如 "16:9", "1:1", "4:3" 等
  const parseRatio = (ratioStr: string) => {
    const parts = ratioStr.split(':');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const width = parseFloat(parts[0]);
      const height = parseFloat(parts[1]);
      return { width, height };
    }
    return { width: 1, height: 1 }; // 默认正方形
  };

  const { width, height } = parseRatio(ratio);

  // 计算显示尺寸，保持最大尺寸为16px
  const maxSize = 24;
  const aspectRatio = width / height;

  let displayWidth = maxSize;
  let displayHeight = maxSize;

  if (aspectRatio > 1) {
    // 宽大于高
    displayHeight = maxSize / aspectRatio;
  } else if (aspectRatio < 1) {
    // 高大于宽
    displayWidth = maxSize * aspectRatio;
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center">
      <div
        className="rounded-[4px] border-2 border-current/80"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
        }}
      />
    </div>
  );
};

interface GenerationSchemaFormProps {
  schema: Exclude<JSONSchema, boolean>;
  form: UseFormReturn<any>;
  fieldPath?: string;
  hideLabel?: boolean;
  modelName?: string;
}

// 解析 description 中的特殊格式 [key:value]
const parseDescription = (description?: string) => {
  const result: { [key: string]: string } = {};

  if (!description) return result;

  // 提取所有 [key:value] 格式的内容
  const matches = description.match(/\[([^:]+):([^\]]+)\]/g);

  if (matches) {
    matches.forEach(match => {
      const content = match.slice(1, -1); // 移除 [ 和 ]
      const [key, value] = content.split(':');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    });
  }

  return result;
};

// VoiceSelector 组件
interface VoiceSelectorProps {
  form: UseFormReturn<any>;
  formFieldPath: string;
  displayLabel: string;
  hideLabel: boolean;
  modelName: string;
}

const VoiceSelector = ({ form, formFieldPath, displayLabel, hideLabel, modelName }: VoiceSelectorProps) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = async () => {
      if (!modelName) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getAigcVoiceList({ modelName });
        if (result.error) {
          setError(result.error);
        } else {
          console.log('result.data', result.data);
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
  }, [modelName]);

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
          <Select onValueChange={formField.onChange} value={formField.value}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loading ? '加载中...' : error ? '加载失败' : `选择${displayLabel}`} />
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

// 检查字段是否应该显示
const shouldShowField = (showWhen: string | undefined, form: UseFormReturn<any>) => {
  if (!showWhen) return true;

  // 解析 showWhen 条件，格式：fieldName=value
  const [fieldName, expectedValue] = showWhen.split('=');
  if (!fieldName || expectedValue === undefined) return true;

  const fieldPath = `params.${fieldName.trim()}`;
  const actualValue = form.watch(fieldPath);

  // 处理布尔值
  if (expectedValue === 'true') return actualValue === true;
  if (expectedValue === 'false') return actualValue === false;

  // 处理其他值
  return actualValue === expectedValue;
};

// 从 JSON schema 或 zod schema 中提取默认值
export const extractDefaultValuesFromSchema = (schema: any, fieldPath = ''): Record<string, any> => {
  const defaultValues: Record<string, any> = {};

  if (!schema) {
    return defaultValues;
  }

  // 处理 allOf 类型
  if (schema.allOf && Array.isArray(schema.allOf)) {
    for (const subSchema of schema.allOf) {
      if (typeof subSchema !== 'boolean' && subSchema) {
        Object.assign(defaultValues, extractDefaultValuesFromSchema(subSchema, fieldPath));
      }
    }
    return defaultValues;
  }

  // 处理 anyOf 类型 - 使用第一个选项的默认值
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const firstSchema = schema.anyOf[0];
    if (typeof firstSchema !== 'boolean' && firstSchema) {
      return extractDefaultValuesFromSchema(firstSchema, fieldPath);
    }
    return defaultValues;
  }

  // 处理 object 类型
  if (schema.type === 'object' && schema.properties) {
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
      if (typeof propertySchema === 'boolean' || !propertySchema) continue;

      const currentFieldPath = fieldPath ? `${fieldPath}.${propertyName}` : propertyName;
      const propertyDefaults = extractDefaultValuesFromSchema(propertySchema, currentFieldPath);
      Object.assign(defaultValues, propertyDefaults);
    }
    return defaultValues;
  }

  // 处理 array 类型
  if (schema.type === 'array') {
    // 数组默认值为空数组
    const fieldName = schema.title || fieldPath || 'value';
    defaultValues[fieldName] = [];
    return defaultValues;
  }

  // 处理其他类型的默认值
  const fieldName = schema.title || fieldPath || 'value';

  // 优先使用 schema.default
  if (schema.default !== undefined) {
    defaultValues[fieldName] = schema.default;
    return defaultValues;
  }

  // 根据类型设置默认值
  switch (schema.type) {
    case 'string':
      // 对于 const 字段，使用 const 值
      if (schema.const !== undefined) {
        defaultValues[fieldName] = schema.const;
      }
      // 对于枚举，使用第一个选项
      else if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
        defaultValues[fieldName] = schema.enum[0];
      }
      break;

    case 'number':
    case 'integer':
      // 使用最小值或 0
      if (schema.minimum !== undefined) {
        defaultValues[fieldName] = schema.minimum;
      } else {
        defaultValues[fieldName] = 0;
      }
      break;

    case 'boolean':
      defaultValues[fieldName] = false;
      break;

    case 'object':
      defaultValues[fieldName] = {};
      break;
  }

  return defaultValues;
};

export const GenerationSchemaForm = (props: GenerationSchemaFormProps) => {
  const { schema, form, fieldPath = '', hideLabel = false, modelName } = props;

  if (!schema) {
    return null;
  }

  // 检查字段依赖条件
  const descriptionMeta = parseDescription(schema.description);
  if (!shouldShowField(descriptionMeta.showWhen, form)) {
    return null;
  }

  // 处理 allOf 类型
  if (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return <AllOfForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} />;
  }

  // 处理 anyOf 类型
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return <AnyOfForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} />;
  }

  if (!schema.type) {
    return null;
  }

  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;

  switch (schema.type) {
    case 'string':
      return <StringForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} modelName={modelName} />;

    case 'number':
    case 'integer':
      return <NumberForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} modelName={modelName} />;

    case 'boolean':
      return <BooleanForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} modelName={modelName} />;

    case 'array':
      return <ArrayForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} modelName={modelName} />;

    case 'object':
      return Object.entries(schema.properties || {}).map(([fieldName, fieldSchema]) => {
        const currentFieldPath = fieldPath ? `${fieldPath}.${fieldName}` : fieldName;

        if (typeof fieldSchema === 'boolean' || !fieldSchema || typeof fieldSchema !== 'object') {
          return null;
        }

        // 检查每个子字段的依赖条件
        const fieldDescriptionMeta = parseDescription(fieldSchema.description);
        if (!shouldShowField(fieldDescriptionMeta.showWhen, form)) {
          return null;
        }

        return <GenerationSchemaForm key={fieldName} schema={fieldSchema} form={form} fieldPath={currentFieldPath} modelName={modelName} />;
      });

    default:
      return (
        <div>
          <FormLabel>
            {fieldName} (Type: {schema.type})
          </FormLabel>
        </div>
      );
  }
};

// String 表单组件
const StringForm = ({ schema, form, fieldPath, hideLabel, modelName }: GenerationSchemaFormProps) => {
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;
  const descriptionMeta = parseDescription(schema.description);
  const displayLabel = descriptionMeta.title || fieldName;

  // 优先检查 renderType
  if (descriptionMeta.renderType === 'ratio') {
    return <RatioForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} modelName={modelName} />;
  }

  // 检查是否为声音选择器
  if (descriptionMeta.renderType === 'voice-selector') {
    return (
      <VoiceSelector
        form={form}
        formFieldPath={formFieldPath}
        displayLabel={displayLabel}
        hideLabel={hideLabel || false}
        modelName={modelName || ''}
      />
    );
  }

  // 优先检查 const 字段
  if (schema.const !== undefined && schema.const !== null) {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={() => (
          <FormItem className="space-y-1">
            {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
            <FormControl>
              <Input value={schema.const as string} readOnly className="bg-muted/50 cursor-not-allowed" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  // 枚举类型，渲染为Select
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.every(item => typeof item === 'string')) {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={({ field: formField }) => (
          <FormItem className="space-y-1">
            {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
            <Select onValueChange={formField.onChange} defaultValue={formField.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`选择${displayLabel}`} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {(schema.enum as string[]).map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  // 检查是否为图片上传字段
  if (descriptionMeta.renderType === 'image') {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={({ field: formField }) => (
          <FormItem className="space-y-1">
            {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
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
  }

  // 根据 renderType 或 format 判断是否使用文本区域
  if (
    descriptionMeta.renderType === 'textarea' ||
    schema.format === 'textarea' ||
    schema.format === 'multiline' ||
    (schema.contentEncoding === 'base64' && schema.format === 'data-url')
  ) {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={({ field: formField }) => (
          <FormItem className="space-y-1">
            {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
            <FormControl>
              <Textarea
                placeholder={`输入${displayLabel}`}
                {...formField}
                className={schema.contentEncoding === 'base64' ? 'font-mono text-sm' : 'min-h-[100px]'}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  // 普通字符串输入
  return (
    <FormField
      key={fieldName}
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
          <FormControl>
            <Input placeholder={`输入${displayLabel}`} {...formField} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// 比例选择组件
const RatioForm = ({ schema, form, fieldPath, hideLabel, modelName }: GenerationSchemaFormProps) => {
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;
  const descriptionMeta = parseDescription(schema.description);
  const displayLabel = descriptionMeta.title || fieldName;

  if (!schema.enum || !Array.isArray(schema.enum)) {
    return null;
  }

  return (
    <FormField
      control={form.control}
      name={formFieldPath}
      render={({ field }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
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

// 数字表单组件
const NumberForm = ({ schema, form, fieldPath, hideLabel, modelName }: GenerationSchemaFormProps) => {
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;
  const descriptionMeta = parseDescription(schema.description);
  const displayLabel = descriptionMeta.title || fieldName;
  const unit = descriptionMeta.unit;

  // 检查是否有范围限制
  const hasRange = schema.minimum !== undefined || schema.maximum !== undefined;
  const min = schema.minimum ?? 0;
  const max = schema.maximum ?? 100;
  const step = schema.multipleOf ?? 1;
  const isFixedValue = min === max;

  return (
    <FormField
      key={fieldName}
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
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
                  placeholder={`输入${displayLabel}`}
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
                {unit && <div className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">{unit}</div>}
              </div>
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// 布尔表单组件
const BooleanForm = ({ schema, form, fieldPath, hideLabel, modelName }: GenerationSchemaFormProps) => {
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;
  const descriptionMeta = parseDescription(schema.description);
  const displayLabel = descriptionMeta.title || fieldName;

  return (
    <FormField
      key={fieldName}
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
          <FormControl>
            <Switch checked={formField.value} onCheckedChange={formField.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
};

// AllOf 表单组件
const AllOfForm = ({ schema, form, fieldPath, hideLabel, modelName }: GenerationSchemaFormProps) => {
  if (!schema.allOf || !Array.isArray(schema.allOf) || schema.allOf.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {schema.allOf.map((subSchema, index) => {
        if (typeof subSchema === 'boolean' || !subSchema) {
          return null;
        }
        return <GenerationSchemaForm key={index} schema={subSchema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} modelName={modelName} />;
      })}
    </div>
  );
};

// AnyOf 表单组件
const AnyOfForm = ({ schema, form, fieldPath, hideLabel, modelName }: GenerationSchemaFormProps) => {
  const [selectedSchemaIndex, setSelectedSchemaIndex] = useState(0);
  const fieldName = schema.title || fieldPath || 'value';
  const descriptionMeta = parseDescription(schema.description);
  const displayLabel = descriptionMeta.title || fieldName;

  if (!schema.anyOf || !Array.isArray(schema.anyOf) || schema.anyOf.length === 0) {
    return null;
  }

  const selectedSchema = schema.anyOf[selectedSchemaIndex];
  if (!selectedSchema || typeof selectedSchema === 'boolean') {
    return null;
  }

  return (
    <FormItem className="space-y-1">
      {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}

      <div className="space-y-2">
        <FormLabel className="text-muted-foreground text-xs">选择类型:</FormLabel>
        <Select value={selectedSchemaIndex.toString()} onValueChange={value => setSelectedSchemaIndex(parseInt(value))}>
          <FormControl>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {schema.anyOf.map((schemaOption, index) => {
              if (typeof schemaOption === 'boolean') return null;
              const optionTitle = schemaOption.title || `选项 ${index + 1}`;
              const optionType = schemaOption.type || '未知类型';
              return (
                <SelectItem key={index} value={index.toString()}>
                  {optionTitle} ({optionType})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border/30 bg-muted/20 rounded-md border p-3">
        <GenerationSchemaForm schema={selectedSchema} form={form} fieldPath={fieldPath} hideLabel={true} modelName={modelName} />
      </div>
    </FormItem>
  );
};

// Array 表单组件
const ArrayForm = ({ schema, form, fieldPath, hideLabel, modelName }: GenerationSchemaFormProps) => {
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;
  const descriptionMeta = parseDescription(schema.description);
  const displayLabel = descriptionMeta.title || fieldName;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: formFieldPath,
  });

  // 检查是否为图片数组
  const isImageArray = descriptionMeta.renderType === 'imageArray';

  if (isImageArray) {
    return <ImageArrayForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} />;
  }

  const addNewItem = () => {
    const itemSchema = schema.items;
    if (itemSchema && typeof itemSchema === 'object' && !Array.isArray(itemSchema) && 'type' in itemSchema) {
      let emptyValue: unknown;
      switch (itemSchema.type) {
        case 'string':
          emptyValue = '';
          break;
        case 'number':
        case 'integer':
          emptyValue = undefined;
          break;
        case 'boolean':
          emptyValue = undefined;
          break;
        case 'array':
          emptyValue = [];
          break;
        case 'object':
          emptyValue = {};
          break;
        default:
          emptyValue = undefined;
      }
      append(emptyValue);
    } else {
      append(undefined);
    }
  };

  const deleteItem = (index: number) => {
    remove(index);
  };

  const renderArrayItem = (item: unknown, index: number) => {
    const itemSchema = schema.items;
    let actualSchema: Exclude<JSONSchema, boolean> | null = null;

    if (itemSchema && typeof itemSchema === 'object' && !Array.isArray(itemSchema) && 'type' in itemSchema) {
      actualSchema = itemSchema as Exclude<JSONSchema, boolean>;
    }

    if (!actualSchema || typeof actualSchema === 'boolean') {
      return null;
    }

    const isComplexType = actualSchema.type === 'object' || actualSchema.type === 'array';

    return (
      <div key={index} className="flex items-center justify-between gap-2">
        <div className={`flex-1 ${isComplexType ? 'border-border/30 bg-muted/20 rounded-md border p-3' : ''}`}>
          <GenerationSchemaForm schema={actualSchema} form={form} fieldPath={`${fieldPath}.${index}`} hideLabel={true} modelName={modelName} />
        </div>
        <div className="flex gap-1">
          <Trash2 className="text-destructive/50 hover:text-destructive h-4 w-4 cursor-pointer transition-colors" onClick={() => deleteItem(index)} />
        </div>
      </div>
    );
  };

  return (
    <FormItem className="space-y-1">
      {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}
      <div className="space-y-3">
        {fields.length === 0 ? (
          <div className="text-muted-foreground text-sm italic">暂无项目</div>
        ) : (
          fields.map((item, index) => renderArrayItem(item, index))
        )}
        <Button type="button" variant="outline" onClick={addNewItem} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          添加新项
        </Button>
      </div>
      <FormMessage />
    </FormItem>
  );
};

// 图片数组表单组件
const ImageArrayForm: React.FC<GenerationSchemaFormProps> = ({ schema, form, fieldPath, hideLabel }) => {
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;
  const descriptionMeta = parseDescription(schema.description);
  const displayLabel = descriptionMeta.title || fieldName;

  // 获取最大图片数量限制
  const maxItems = schema.maxItems || 10; // 默认最大10张图片

  // 获取当前表单值
  const currentImages = form.watch(formFieldPath) || [];

  // 处理图片数组变化
  const handleImagesChange = (urls: string[]) => {
    form.setValue(formFieldPath, urls);
  };

  return (
    <FormItem className="space-y-1">
      {!hideLabel && <FormLabel>{displayLabel}</FormLabel>}

      <MultiImageUpload
        value={currentImages}
        onChange={handleImagesChange}
        accept="image/*"
        maxSize={10 * 1024 * 1024} // 10MB
        maxFiles={maxItems}
        uploadPath="paintboard"
        itemSize="sm"
        gridCols={4}
      />

      <FormMessage />
    </FormItem>
  );
};
