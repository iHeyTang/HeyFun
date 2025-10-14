import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo, useState } from 'react';

interface AdvancedOptionsFormProps {
  schema: Record<string, any>;
  values?: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  title?: string;
}

/**
 * 从 description 中解析标题
 * 格式: [title:xxx]
 */
const parseTitleFromDescription = (description?: string): { title: string | null; cleanDescription: string } => {
  if (!description) {
    return { title: null, cleanDescription: '' };
  }

  const titleMatch = description.match(/\[title:([^\]]+)\]/);
  if (titleMatch) {
    const title = titleMatch[1] || null;
    const cleanDescription = description.replace(/\[title:[^\]]+\]\s*/, '').trim();
    return { title, cleanDescription };
  }

  return { title: null, cleanDescription: description };
};

/**
 * 高级参数表单组件
 * 根据 JSON Schema 动态渲染表单字段，内置折叠面板功能
 */
export const AdvancedOptionsForm = memo(({ schema, values = {}, onChange, title = '高级选项' }: AdvancedOptionsFormProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleFieldChange = (fieldName: string, value: any) => {
    onChange({
      ...values,
      [fieldName]: value,
    });
  };

  // 如果没有高级选项，不渲染
  if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
    return null;
  }

  const renderField = (fieldName: string, fieldSchema: any) => {
    const fieldValue = values[fieldName];
    const fieldType = fieldSchema.type;

    // 解析标题
    const { title: parsedTitle, cleanDescription } = parseTitleFromDescription(fieldSchema.description);
    const displayTitle = parsedTitle || fieldSchema.title || fieldName;
    const displayDescription = cleanDescription || fieldSchema.description;

    // 字符串类型
    if (fieldType === 'string') {
      // 枚举类型 - 下拉选择
      if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
        return (
          <div key={fieldName} className="hover:bg-muted -mx-1 flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors">
            <Label className="text-muted-foreground w-32 shrink-0 text-xs">{displayTitle}</Label>
            <Select value={fieldValue || fieldSchema.default || ''} onValueChange={value => handleFieldChange(fieldName, value)}>
              <SelectTrigger size="sm" className="min-w-32 flex-1 text-xs">
                <SelectValue placeholder={`选择${displayTitle}`} />
              </SelectTrigger>
              <SelectContent>
                {fieldSchema.enum.map((option: string) => (
                  <SelectItem key={option} value={option} className="text-xs">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }

      // 多行文本
      if (fieldSchema.format === 'textarea') {
        return (
          <div key={fieldName} className="hover:bg-muted -mx-1 flex gap-2 rounded-md px-1.5 py-1 transition-colors">
            <Label className="text-muted-foreground w-32 shrink-0 pt-1 text-xs">{displayTitle}</Label>
            <Textarea
              value={fieldValue || fieldSchema.default || ''}
              onChange={e => handleFieldChange(fieldName, e.target.value)}
              placeholder={displayDescription || `输入${displayTitle}`}
              className="min-h-[50px] flex-1 text-xs"
            />
          </div>
        );
      }

      // 普通文本输入
      return (
        <div key={fieldName} className="hover:bg-muted -mx-1 flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors">
          <Label className="text-muted-foreground w-32 shrink-0 text-xs">{displayTitle}</Label>
          <Input
            type="text"
            value={fieldValue || fieldSchema.default || ''}
            onChange={e => handleFieldChange(fieldName, e.target.value)}
            placeholder={displayDescription || `输入${displayTitle}`}
            className="h-8 min-w-32 flex-1 text-xs"
          />
        </div>
      );
    }

    // 数字类型
    if (fieldType === 'number' || fieldType === 'integer') {
      const hasRange = fieldSchema.minimum !== undefined || fieldSchema.maximum !== undefined;
      const min = fieldSchema.minimum ?? 0;
      const max = fieldSchema.maximum ?? 100;
      const step = fieldSchema.multipleOf ?? (fieldType === 'integer' ? 1 : 0.1);
      const currentValue = fieldValue !== undefined ? fieldValue : (fieldSchema.default ?? min);

      // 有范围限制 - 使用滑块
      if (hasRange && min !== max) {
        return (
          <div key={fieldName} className="hover:bg-muted -mx-1 flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors">
            <Label className="text-muted-foreground w-32 shrink-0 text-xs">{displayTitle}</Label>
            <div className="flex flex-1 items-center space-y-1 text-[11px]">
              <div className="text-muted-foreground w-8 text-center">{min}</div>
              <div className="flex-1">
                <Slider
                  value={[currentValue]}
                  onValueChange={([value]) => handleFieldChange(fieldName, value)}
                  min={min}
                  max={max}
                  step={step}
                  className="w-full"
                />
              </div>
              <div className="text-muted-foreground w-8 text-center">{max}</div>
            </div>
          </div>
        );
      }

      // 普通数字输入
      return (
        <div key={fieldName} className="hover:bg-muted -mx-1 flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors">
          <Label className="text-muted-foreground w-32 shrink-0 text-xs">{displayTitle}</Label>
          <Input
            type="number"
            value={currentValue}
            onChange={e => {
              const value = e.target.value === '' ? undefined : Number(e.target.value);
              handleFieldChange(fieldName, value);
            }}
            min={min}
            max={max}
            step={step}
            placeholder={displayDescription || `输入${displayTitle}`}
            className="h-8 min-w-32 flex-1 text-xs"
          />
        </div>
      );
    }

    // 布尔类型
    if (fieldType === 'boolean') {
      return (
        <div key={fieldName} className="hover:bg-muted -mx-1 flex items-center justify-between gap-2 rounded-md px-1.5 py-1 transition-colors">
          <Label className="text-muted-foreground w-32 shrink-0 text-xs">{displayTitle}</Label>
          <Switch checked={fieldValue ?? fieldSchema.default ?? false} onCheckedChange={checked => handleFieldChange(fieldName, checked)} />
        </div>
      );
    }

    // 不支持的类型
    return (
      <div key={fieldName} className="hover:bg-muted -mx-1 flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors">
        <Label className="text-muted-foreground w-32 shrink-0 text-xs">{displayTitle}</Label>
        <span className="text-muted-foreground flex-1 text-xs">(不支持的类型: {fieldType})</span>
      </div>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-muted-foreground h-7 w-full justify-between px-1 text-xs">
          <span>{title}</span>
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-1 px-1">
        <div className="space-y-1">
          {Object.entries(schema.properties || {}).map(([fieldName, fieldSchema]: [string, any]) => {
            return renderField(fieldName, fieldSchema);
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

AdvancedOptionsForm.displayName = 'AdvancedOptionsForm';
