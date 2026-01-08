/**
 * 环境变量表单消息渲染器
 * 在对话结尾渲染表单，让用户填写环境变量
 */

'use client';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Info } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateEnvironmentVariables, getEnvironmentVariables } from '@/actions/settings';
import { toast } from 'sonner';
import { useEnvironmentVariables } from '@/hooks/use-environment-variables';
import type { MessageRendererProps } from './types';
import { useChatMessagesStore } from '@/hooks/use-chat-messages';

interface VariableInfo {
  variableName: string;
  description: string;
}

interface EnvironmentVariableFormData {
  type: 'environment_variable_form';
  variables: VariableInfo[];
  message: string;
}

export function EnvironmentVariableFormRenderer({ data, onSendMessage, isLastMessage, sessionId }: MessageRendererProps & { sessionId?: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { update } = useEnvironmentVariables();
  const { sessionMessages } = useChatMessagesStore();
  const messages = useMemo(() => {
    return sessionId ? sessionMessages[sessionId] || [] : [];
  }, [sessionId, sessionMessages]);

  // 解析消息数据
  const formData = useMemo(() => data as EnvironmentVariableFormData, [data]);
  const variables = useMemo(() => formData.variables || [], [formData]);
  const message = formData.message || '需要配置环境变量';

  // 检查是否有新的用户消息（表单已提交的标志）
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      // 找到这条表单消息的索引
      const formMessageIndex = messages.findIndex(msg => {
        try {
          const parsed = JSON.parse(msg.content);
          return parsed.type === 'environment_variable_form';
        } catch {
          return false;
        }
      });

      if (formMessageIndex >= 0) {
        // 检查是否有在这条消息之后的用户消息
        const hasNewUserMessage = messages.some((msg, index) => index > formMessageIndex && msg.role === 'user');
        if (hasNewUserMessage) {
          setIsSubmitted(true);
        }
      }
    }
  }, [messages, sessionId]);

  // 动态创建表单 schema
  const formSchema = useMemo(() => {
    const schemaFields: Record<string, z.ZodString> = {};
    variables.forEach(v => {
      schemaFields[v.variableName] = z.string().min(1, `请输入 ${v.variableName} 的值`);
    });
    return z.object(schemaFields);
  }, [variables]);

  type FormValues = z.infer<typeof formSchema>;

  // 创建默认值
  const defaultValues = useMemo(() => {
    return variables.reduce(
      (acc, v) => {
        acc[v.variableName] = '';
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [variables]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const onSubmit = async (values: FormValues) => {
    if (variables.length === 0 || isSubmitted) return;

    setIsSubmitting(true);
    try {
      // 获取当前所有环境变量
      const currentVars = await getEnvironmentVariables({});
      const currentVariables = (currentVars.data?.variables as Record<string, string>) || {};

      // 更新环境变量（添加所有新配置的变量）
      const updatedVariables: Record<string, string> = { ...currentVariables };
      Object.entries(values).forEach(([key, value]) => {
        if (value && value.trim()) {
          updatedVariables[key] = value;
        }
      });

      // 保存所有变量
      await update(updatedVariables);

      // 标记为已提交
      setIsSubmitted(true);

      // 发送消息继续 workflow（可以发送一个简单的确认消息，或者空消息触发 workflow 继续）
      if (onSendMessage) {
        onSendMessage('环境变量已配置，请继续执行任务。');
      }

      toast.success('环境变量配置成功', {
        description: `已成功配置 ${variables.length} 个环境变量`,
      });
    } catch (error) {
      toast.error('配置失败', {
        description: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 如果不是最后一条消息，或不满足显示条件，则不渲染
  if (!isLastMessage || isSubmitted || variables.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 gap-3 px-4">
      {/* 占位，保持与assistant消息对齐 */}
      <div className="h-8 w-8 flex-shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border/20 bg-muted/20 max-w-[70%] rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <div className="text-sm font-medium">需要配置环境变量</div>
          </div>
          <p className="text-muted-foreground mb-4 text-sm">{message}</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {variables.map(variable => (
                <FormField
                  key={variable.variableName}
                  control={form.control}
                  name={variable.variableName}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{variable.variableName}</code>
                      </FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={`请输入 ${variable.variableName} 的值`} {...field} disabled={isSubmitted} />
                      </FormControl>
                      {variable.description && <FormDescription>{variable.description}</FormDescription>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button type="submit" disabled={isSubmitting || isSubmitted} className="w-full">
                {isSubmitting ? '保存中...' : isSubmitted ? '已提交' : `保存 ${variables.length} 个变量`}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
