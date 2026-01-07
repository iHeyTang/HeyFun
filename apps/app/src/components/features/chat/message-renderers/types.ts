/**
 * 消息渲染器的类型定义
 */

export interface CustomMessageData {
  type: string;
  [key: string]: any;
}

export interface MessageRendererProps {
  data: CustomMessageData;
  onSendMessage?: (content: string) => void;
  isLastMessage?: boolean;
  modelId?: string;
}

export type MessageRenderer = React.ComponentType<MessageRendererProps>;

