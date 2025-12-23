/**
 * A2UI (Agent-to-User Interface) 类型定义
 * 基于 A2UI 协议的声明式 UI 格式
 */

/**
 * A2UI 消息类型
 */
export type A2UIMessageType = 'ui/init' | 'ui/update' | 'ui/append' | 'ui/remove' | 'ui/event' | 'ui/complete';

/**
 * A2UI 组件类型
 */
export type A2UIComponentType =
  | 'container'
  | 'text'
  | 'button'
  | 'input'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'image'
  | 'link'
  | 'list'
  | 'card'
  | 'form'
  | 'divider'
  | 'spacer';

/**
 * A2UI 布局方向
 */
export type A2UILayoutDirection = 'row' | 'column';

/**
 * A2UI 对齐方式
 */
export type A2UIAlign = 'start' | 'center' | 'end' | 'stretch';

/**
 * A2UI 样式属性
 */
export interface A2UIStyle {
  width?: string | number;
  height?: string | number;
  padding?: string | number;
  margin?: string | number;
  backgroundColor?: string;
  color?: string;
  fontSize?: string | number;
  fontWeight?: string | number;
  borderRadius?: string | number;
  border?: string;
  display?: 'flex' | 'block' | 'inline' | 'none';
  flexDirection?: A2UILayoutDirection;
  alignItems?: A2UIAlign;
  justifyContent?: A2UIAlign;
  gap?: string | number;
  flex?: number;
}

/**
 * A2UI 事件处理器
 */
export interface A2UIEventHandler {
  type: string;
  action?: string;
  data?: Record<string, unknown>;
}

/**
 * A2UI 组件基础接口
 */
export interface A2UIComponent {
  id: string;
  type: A2UIComponentType;
  style?: A2UIStyle;
  children?: A2UIComponent[];
  visible?: boolean;
  disabled?: boolean;
  onEvent?: A2UIEventHandler[];
}

/**
 * 组件类型已内聚到各自的组件文件中
 * 这里重新导出以保持向后兼容
 */
export type {
  A2UITextComponent,
  A2UIButtonComponent,
  A2UIInputComponent,
  A2UITextareaComponent,
  A2UISelectComponent,
  A2UICheckboxComponent,
  A2UIRadioComponent,
  A2UIImageComponent,
  A2UILinkComponent,
  A2UIListComponent,
  A2UICardComponent,
  A2UIFormComponent,
  A2UIContainerComponent,
} from './components';

/**
 * A2UI 消息
 */
export interface A2UIMessage {
  type: A2UIMessageType;
  id?: string;
  timestamp?: number;
  component?: A2UIComponent;
  components?: A2UIComponent[];
  targetId?: string;
  event?: {
    type: string;
    componentId: string;
    data?: Record<string, unknown>;
  };
}

/**
 * A2UI 状态
 */
export interface A2UIState {
  components: Map<string, A2UIComponent>;
  rootComponents: string[];
  version: number;
}
