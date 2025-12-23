'use client';

import React, { useState, useCallback, useRef } from 'react';
import { A2UIMessageComponent } from '@/components/features/a2ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { A2UIMessage } from '@/components/features/a2ui/types';

interface HumanInLoopResultProps {
  args?: Record<string, any>;
  result?: {
    title?: string;
    description?: string;
    message?: A2UIMessage;
    required?: boolean;
    waiting?: boolean;
    messageId?: string;
    toolCallId?: string;
    eventName?: string;
    data?: {
      title?: string;
      description?: string;
      message?: A2UIMessage;
      required?: boolean;
      waiting?: boolean;
      messageId?: string;
      toolCallId?: string;
      eventName?: string;
    };
  };
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  messageId?: string;
  toolCallId?: string;
  sessionId?: string;
}

/**
 * Human-in-Loop 工具结果渲染器
 * 显示界面供用户填写/确认，用户提交后通过 tool-result API 提交结果
 */
export function HumanInLoopResult({ result, status, error, messageId, toolCallId: propToolCallId, sessionId }: HumanInLoopResultProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formDataRef = useRef<Record<string, any>>({});

  // 从 result 中提取数据
  const data = result?.data || result;
  const title = data?.title || '请填写信息';
  const description = data?.description;
  const message = data?.message;
  const required = data?.required !== false;
  const toolCallId = data?.toolCallId || propToolCallId;

  // 提交表单数据
  const handleSubmit = useCallback(
    async (submitData: Record<string, any>) => {
      if (!messageId || !toolCallId) {
        console.error('[HumanInLoop] Missing messageId or toolCallId');
        return;
      }

      if (!sessionId) {
        console.error('[HumanInLoop] Missing sessionId');
        alert('会话 ID 缺失，请刷新页面后重试');
        return;
      }

      setIsSubmitting(true);
      try {
        // 调用 tool-result API 提交结果
        const response = await fetch('/api/chat/tool-result', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            messageId,
            toolResults: [
              {
                toolCallId,
                result: {
                  success: true,
                  data: {
                    submitted: true,
                    formData: submitData,
                  },
                },
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to submit tool result');
        }

        // 提交成功，界面会由 workflow 更新
      } catch (error) {
        console.error('[HumanInLoop] Failed to submit:', error);
        alert('提交失败，请重试');
      } finally {
        setIsSubmitting(false);
      }
    },
    [messageId, toolCallId, sessionId],
  );

  // 处理 A2UI 事件，收集表单数据
  const handleA2UIEvent = useCallback(
    (event: { type: string; componentId: string; data?: Record<string, unknown> }) => {
      if (event.type === 'change' || event.type === 'input') {
        // 收集输入数据
        const newValue = event.data?.value;
        formDataRef.current = {
          ...formDataRef.current,
          [event.componentId]: newValue,
        };
        setFormData(formDataRef.current);
      } else if (event.type === 'submit') {
        // 表单提交：使用收集到的所有表单数据
        handleSubmit((event.data as Record<string, any>) || formDataRef.current);
      } else if (event.type === 'click' && event.componentId) {
        // 按钮点击：如果按钮在表单内，可能会触发表单提交
        // 这里只收集数据，不直接提交（由表单的 submit 事件处理）
      }
    },
    [handleSubmit],
  );

  if (status === 'error' && error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">错误</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (status === 'pending' || status === 'running') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>正在准备界面...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!message) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>错误</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">未找到 A2UI 消息</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 渲染 A2UI 界面，提交按钮应该作为 A2UI 组件的一部分 */}
        <A2UIMessageComponent message={message} onEvent={handleA2UIEvent} />
        {isSubmitting && <div className="text-muted-foreground text-center text-sm">提交中...</div>}
      </CardContent>
    </Card>
  );
}
