/**
 * 消息渲染器注册中心
 * 统一管理所有特殊消息类型的渲染器
 */

import { SuggestedQuestionsRenderer } from './suggested-questions-renderer';
import { EnvironmentVariableFormRenderer } from './environment-variable-form-renderer';
import type { MessageRenderer } from './types';

/**
 * 消息渲染器注册表
 */
const messageRenderers: Record<string, MessageRenderer> = {
  suggested_questions: SuggestedQuestionsRenderer,
  environment_variable_form: EnvironmentVariableFormRenderer,
};

/**
 * 获取消息渲染器
 * @param messageType 消息类型
 * @returns 渲染器组件，如果不存在则返回 null
 */
export function getMessageRenderer(messageType: string): MessageRenderer | null {
  return messageRenderers[messageType] || null;
}

/**
 * 注册新的消息渲染器
 * @param messageType 消息类型
 * @param renderer 渲染器组件
 */
export function registerMessageRenderer(messageType: string, renderer: MessageRenderer): void {
  messageRenderers[messageType] = renderer;
}

/**
 * 获取所有已注册的消息类型
 */
export function getRegisteredMessageTypes(): string[] {
  return Object.keys(messageRenderers);
}

// 导出所有渲染器，方便直接使用
export { SuggestedQuestionsRenderer } from './suggested-questions-renderer';
export { EnvironmentVariableFormRenderer } from './environment-variable-form-renderer';
export type { MessageRendererProps, CustomMessageData } from './types';
