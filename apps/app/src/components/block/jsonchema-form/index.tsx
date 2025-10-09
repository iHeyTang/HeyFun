import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { JSONSchema } from 'json-schema-to-ts';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import * as React from 'react';

// 自定义渲染器类型
export interface CustomFieldRenderer {
  (props: CustomFieldRendererProps): React.ReactNode;
}

export interface CustomFieldRendererProps {
  schema: Exclude<JSONSchema, boolean>;
  form: UseFormReturn<any>;
  fieldPath: string;
  fieldName: string;
  formFieldPath: string;
  hideLabel?: boolean;
  renderContext?: Record<string, any>;
  t?: (key: string) => string;
}

// 自定义渲染映射表类型
export type RenderMap = Map<string, CustomFieldRenderer>;

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

export interface JsonSchemaFormProps {
  schema: Exclude<JSONSchema, boolean>;
  form: UseFormReturn<any>;
  fieldPath?: string;
  hideLabel?: boolean;
  renderMap?: RenderMap;
  renderContext?: Record<string, any>;
  t?: (key: string) => string;
}

/**
 * 底层通用 JSON Schema 表单渲染器
 * 支持通过 renderMap 扩展自定义字段渲染
 */
export const JsonSchemaForm = (props: JsonSchemaFormProps) => {
  const { schema, form, fieldPath = '', hideLabel = false, renderMap, renderContext, t } = props;

  if (!schema) {
    return null;
  }

  // 处理 allOf 类型
  if (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return <AllOfForm {...props} />;
  }

  // 处理 anyOf 类型
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return <AnyOfForm {...props} />;
  }

  if (!schema.type) {
    return null;
  }

  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;

  // 检查是否有自定义渲染器
  if (renderMap && renderMap.has(fieldName)) {
    const customRenderer = renderMap.get(fieldName);
    if (customRenderer) {
      return customRenderer({
        schema,
        form,
        fieldPath,
        fieldName,
        formFieldPath,
        hideLabel,
        renderContext,
        t,
      });
    }
  }

  // 默认渲染逻辑
  switch (schema.type) {
    case 'string':
      return <StringForm {...props} />;

    case 'number':
    case 'integer':
      return <NumberForm {...props} />;

    case 'boolean':
      return <BooleanForm {...props} />;

    case 'array':
      return <ArrayForm {...props} />;

    case 'object':
      return Object.entries(schema.properties || {}).map(([fieldName, fieldSchema]) => {
        const currentFieldPath = fieldPath ? `${fieldPath}.${fieldName}` : fieldName;

        if (typeof fieldSchema === 'boolean' || !fieldSchema || typeof fieldSchema !== 'object') {
          return null;
        }

        return <JsonSchemaForm key={fieldName} {...props} schema={fieldSchema} fieldPath={currentFieldPath} t={t} />;
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

// AllOf 表单组件
const AllOfForm = (props: JsonSchemaFormProps) => {
  const { schema, t } = props;

  if (!schema.allOf || !Array.isArray(schema.allOf) || schema.allOf.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {schema.allOf.map((subSchema, index) => {
        if (typeof subSchema === 'boolean' || !subSchema) {
          return null;
        }
        return <JsonSchemaForm key={index} {...props} schema={subSchema} />;
      })}
    </div>
  );
};

// AnyOf 表单组件
const AnyOfForm = (props: JsonSchemaFormProps) => {
  const { schema, fieldPath, hideLabel, t } = props;
  const [selectedSchemaIndex, setSelectedSchemaIndex] = useState(0);
  const fieldName = schema.title || fieldPath || 'value';

  if (!schema.anyOf || !Array.isArray(schema.anyOf) || schema.anyOf.length === 0) {
    return null;
  }

  const selectedSchema = schema.anyOf[selectedSchemaIndex];
  if (!selectedSchema || typeof selectedSchema === 'boolean') {
    return null;
  }

  return (
    <FormItem className="space-y-1">
      {!hideLabel && <FormLabel>{fieldName}</FormLabel>}

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
        <JsonSchemaForm {...props} schema={selectedSchema} hideLabel={true} />
      </div>
    </FormItem>
  );
};

// String 表单组件
const StringForm = (props: JsonSchemaFormProps) => {
  const { schema, form, fieldPath, hideLabel, t } = props;
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;

  // 优先检查 const 字段
  if (schema.const !== undefined && schema.const !== null) {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={() => (
          <FormItem className="space-y-1">
            {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
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
            {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
            <Select onValueChange={formField.onChange} defaultValue={formField.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`选择${t?.(fieldName)}`} />
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

  // 文本区域字段
  const shouldUseTextarea =
    schema.format === 'textarea' || schema.format === 'multiline' || (schema.contentEncoding === 'base64' && schema.format === 'data-url');

  if (shouldUseTextarea) {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={({ field: formField }) => (
          <FormItem className="space-y-1">
            {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
            <FormControl>
              <Textarea
                placeholder={`输入${t?.(fieldName)}`}
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

  // 特殊格式处理
  if (schema.format === 'email') {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={({ field: formField }) => (
          <FormItem className="space-y-1">
            {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
            <FormControl>
              <Input type="email" placeholder={`输入${t?.(fieldName)}`} {...formField} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  if (schema.format === 'uri' || schema.format === 'url') {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={({ field: formField }) => (
          <FormItem className="space-y-1">
            {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
            <FormControl>
              <Input type="url" placeholder={`输入${t?.(fieldName)}`} {...formField} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  if (schema.format === 'date' || schema.format === 'date-time') {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={({ field: formField }) => (
          <FormItem className="space-y-1">
            {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
            <FormControl>
              <Input type={schema.format === 'date' ? 'date' : 'datetime-local'} placeholder={`输入${t?.(fieldName)}`} {...formField} />
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
          {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
          <FormControl>
            <Input placeholder={`输入${t?.(fieldName)}`} {...formField} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// Number 表单组件
const NumberForm = (props: JsonSchemaFormProps) => {
  const { schema, form, fieldPath, hideLabel, t } = props;
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;

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
          {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
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
                  <span className="text-muted-foreground">{min}</span>
                  <span className="bg-primary text-primary-foreground rounded px-2 py-1 text-sm font-semibold">{formField.value ?? min}</span>
                  <span className="text-muted-foreground">{max}</span>
                </div>
              </div>
            ) : (
              <Input
                type="number"
                placeholder={`输入${t?.(fieldName)}`}
                value={isFixedValue ? min : formField.value}
                onChange={e => {
                  if (!isFixedValue) {
                    const value = e.target.value;
                    formField.onChange(value === '' ? undefined : Number(value));
                  }
                }}
                readOnly={isFixedValue}
                className={isFixedValue ? 'bg-muted/50 cursor-not-allowed' : ''}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// Boolean 表单组件
const BooleanForm = (props: JsonSchemaFormProps) => {
  const { schema, form, fieldPath, hideLabel, t } = props;
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;

  return (
    <FormField
      key={fieldName}
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem className="space-y-1">
          {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
          <FormControl>
            <Switch checked={formField.value} onCheckedChange={formField.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
};

// Array 表单组件
const ArrayForm = (props: JsonSchemaFormProps) => {
  const { schema, form, fieldPath, hideLabel, t } = props;
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: formFieldPath,
  });

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
          <JsonSchemaForm {...props} schema={actualSchema} fieldPath={`${fieldPath}.${index}`} hideLabel={true} />
        </div>
        <div className="flex gap-1">
          <Trash2 className="text-destructive/50 hover:text-destructive h-4 w-4 cursor-pointer transition-colors" onClick={() => deleteItem(index)} />
        </div>
      </div>
    );
  };

  return (
    <FormItem className="space-y-1">
      {!hideLabel && <FormLabel>{t?.(fieldName)}</FormLabel>}
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
