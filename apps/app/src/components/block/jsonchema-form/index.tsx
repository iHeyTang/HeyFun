import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { JSONSchema } from 'json-schema-to-ts';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface JsonSchemaFormProps {
  schema: Exclude<JSONSchema, boolean>;
  form: UseFormReturn<any>;
  fieldPath?: string;
  hideLabel?: boolean;
}

export const JsonSchemaForm = (props: JsonSchemaFormProps) => {
  const { schema, form, fieldPath = '', hideLabel = false } = props;

  if (!schema) {
    return null;
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
      return <StringForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} />;

    case 'number':
    case 'integer':
      return (
        <FormField
          key={fieldName}
          control={form.control}
          name={formFieldPath}
          render={({ field: formField }) => (
            <FormItem className="space-y-2">
              {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
              <FormControl>
                <Input type="number" placeholder={`输入${fieldName}`} {...formField} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case 'boolean':
      return (
        <FormField
          key={fieldName}
          control={form.control}
          name={formFieldPath}
          render={({ field: formField }) => (
            <FormItem>
              {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
              <FormControl>
                <Switch checked={formField.value} onCheckedChange={formField.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      );

    case 'array':
      // 数组类型渲染
      return <ArrayForm schema={schema} form={form} fieldPath={fieldPath} hideLabel={hideLabel} />;

    case 'object':
      return Object.entries(schema.properties || {}).map(([fieldName, fieldSchema]) => {
        // 构建完整的字段路径，支持嵌套
        const currentFieldPath = fieldPath ? `${fieldPath}.${fieldName}` : fieldName;

        // 类型守卫：确保 fieldSchema 是有效的 JSONSchema 对象
        if (typeof fieldSchema === 'boolean' || !fieldSchema || typeof fieldSchema !== 'object') {
          return null;
        }

        // 递归调用自身来处理每个字段
        return <JsonSchemaForm key={fieldName} schema={fieldSchema} form={form} fieldPath={currentFieldPath} />;
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

// AnyOf 表单组件
const AnyOfForm = ({ schema, form, fieldPath, hideLabel }: JsonSchemaFormProps) => {
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
    <FormItem className="space-y-3">
      {!hideLabel && <FormLabel>{fieldName}</FormLabel>}

      {/* Schema 选择器 */}
      <div className="space-y-2">
        <FormLabel className="text-muted-foreground text-xs">选择类型:</FormLabel>
        <Select value={selectedSchemaIndex.toString()} onValueChange={value => setSelectedSchemaIndex(parseInt(value))}>
          <FormControl>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
          </FormControl>
          <SelectContent className="bg-background border-border/50">
            {schema.anyOf.map((schemaOption, index) => {
              if (typeof schemaOption === 'boolean') return null;
              const optionTitle = schemaOption.title || `选项 ${index + 1}`;
              const optionType = schemaOption.type || '未知类型';
              return (
                <SelectItem key={index} value={index.toString()} className="hover:bg-muted/50 focus:bg-muted/50">
                  {optionTitle} ({optionType})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* 选中的 Schema 表单 */}
      <div className="border-border/30 bg-muted/20 rounded-md border p-3">
        <JsonSchemaForm schema={selectedSchema} form={form} fieldPath={fieldPath} hideLabel={true} />
      </div>
    </FormItem>
  );
};

// String 表单组件
const StringForm = ({ schema, form, fieldPath, hideLabel }: JsonSchemaFormProps) => {
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;

  // 优先检查 const 字段，如果存在则说明该字段是固定值
  if (schema.const !== undefined && schema.const !== null) {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={() => (
          <FormItem className="space-y-2">
            {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
            <FormControl>
              <Input value={schema.const as string} readOnly className="bg-muted/50 cursor-not-allowed" placeholder={schema.const as string} />
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
          <FormItem className="space-y-2">
            {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
            <Select onValueChange={formField.onChange} defaultValue={formField.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`选择${fieldName}`} />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-background border-border/50">
                {(schema.enum as string[]).map((option: string) => (
                  <SelectItem key={option} value={option} className="hover:bg-muted/50 focus:bg-muted/50">
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

  // 根据 format 和 contentEncoding 选择合适的输入组件
  const shouldUseTextarea =
    schema.format === 'textarea' ||
    fieldName.toLowerCase().includes('prompt') ||
    schema.format === 'multiline' ||
    (schema.contentEncoding === 'base64' && schema.format === 'data-url');

  if (shouldUseTextarea) {
    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={formFieldPath}
        render={({ field: formField }) => (
          <FormItem>
            {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
            <FormControl>
              <Textarea placeholder={`输入${fieldName}`} {...formField} className={schema.contentEncoding === 'base64' ? 'font-mono text-sm' : ''} />
            </FormControl>
            {schema.contentEncoding && <div className="text-muted-foreground text-xs">编码格式: {schema.contentEncoding}</div>}
            {schema.format && <div className="text-muted-foreground text-xs">格式: {schema.format}</div>}
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
          <FormItem>
            {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
            <FormControl>
              <Input type="email" placeholder={`输入${fieldName}`} {...formField} />
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
          <FormItem>
            {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
            <FormControl>
              <Input type="url" placeholder={`输入${fieldName}`} {...formField} />
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
          <FormItem>
            {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
            <FormControl>
              <Input type={schema.format === 'date' ? 'date' : 'datetime-local'} placeholder={`输入${fieldName}`} {...formField} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  // 普通字符串，渲染为Input
  return (
    <FormField
      key={fieldName}
      control={form.control}
      name={formFieldPath}
      render={({ field: formField }) => (
        <FormItem>
          {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
          <FormControl>
            <Input placeholder={`输入${fieldName}`} {...formField} className={schema.contentEncoding === 'base64' ? 'font-mono text-sm' : ''} />
          </FormControl>
          {schema.contentEncoding && <div className="text-muted-foreground text-xs">编码格式: {schema.contentEncoding}</div>}
          {schema.format && <div className="text-muted-foreground text-xs">格式: {schema.format}</div>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// Array 表单组件
const ArrayForm = ({ schema, form, fieldPath, hideLabel }: JsonSchemaFormProps) => {
  const fieldName = schema.title || fieldPath || 'value';
  const formFieldPath = `params.${fieldName}`;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: formFieldPath,
  });

  const addNewItem = () => {
    const itemSchema = schema.items;
    if (itemSchema && typeof itemSchema === 'object' && !Array.isArray(itemSchema) && 'type' in itemSchema) {
      // 根据类型创建空值
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
    } else if (Array.isArray(itemSchema) && itemSchema.length > 0) {
      // 如果items是数组，使用第一个schema
      const firstSchema = itemSchema[0];
      if (firstSchema && typeof firstSchema === 'object' && !Array.isArray(firstSchema) && 'type' in firstSchema) {
        let emptyValue: unknown;
        switch (firstSchema.type) {
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
    } else if (Array.isArray(itemSchema) && itemSchema.length > 0) {
      // 如果items是数组，使用第一个schema
      const firstSchema = itemSchema[0];
      if (firstSchema && typeof firstSchema === 'object' && !Array.isArray(firstSchema) && 'type' in firstSchema) {
        actualSchema = firstSchema as Exclude<JSONSchema, boolean>;
      }
    }

    if (!actualSchema || typeof actualSchema === 'boolean') {
      return null;
    }

    // 判断是否为复杂类型
    const isComplexType = actualSchema.type === 'object' || actualSchema.type === 'array';

    return (
      <div key={index} className="flex items-center justify-between gap-2">
        <div className={`flex-1 ${isComplexType ? 'border-border/30 bg-muted/20 rounded-md border p-3' : ''}`}>
          <JsonSchemaForm schema={actualSchema} form={form} fieldPath={`${fieldPath}.${index}`} hideLabel={true} />
        </div>
        <div className="flex gap-1">
          <Trash2 className="text-destructive/50 hover:text-destructive h-4 w-4 cursor-pointer transition-colors" onClick={() => deleteItem(index)} />
        </div>
      </div>
    );
  };

  return (
    <FormItem className="space-y-3">
      {!hideLabel && <FormLabel>{fieldName}</FormLabel>}
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
