import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * A2UI 组件 Schema（用于 human_in_loop 的 a2uiMessage 参数）
 * 定义 A2UI 组件的完整结构，支持嵌套子组件
 */
const a2uiComponentSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string().describe('组件唯一标识符，用于在表单提交时识别字段'),
    type: z
      .enum([
        'container',
        'text',
        'button',
        'input',
        'textarea',
        'select',
        'checkbox',
        'radio',
        'image',
        'link',
        'list',
        'card',
        'form',
        'divider',
        'spacer',
      ])
      .describe('组件类型'),
    content: z.string().optional().describe('组件内容（适用于 text 类型）'),
    label: z.string().optional().describe('组件标签（适用于 button、input、textarea、select、checkbox、radio 等）'),
    placeholder: z.string().optional().describe('占位符文本（适用于 input、textarea、select）'),
    value: z.union([z.string(), z.number(), z.boolean()]).optional().describe('组件值（适用于 input、textarea、select、checkbox、radio）'),
    variant: z
      .string()
      .optional()
      .describe('组件样式变体。按钮：primary（默认）、secondary、outline、ghost、danger。文本：heading、body（默认）、caption、label'),
    size: z.enum(['small', 'medium', 'large']).optional().describe('组件尺寸（适用于 button）'),
    inputType: z.enum(['text', 'email', 'password', 'number', 'tel', 'url']).optional().describe('输入框类型（适用于 input）'),
    options: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .optional()
      .describe('选项列表（适用于 select）'),
    rows: z.number().optional().describe('行数（适用于 textarea）'),
    checked: z.boolean().optional().describe('是否选中（适用于 checkbox、radio）'),
    group: z.string().optional().describe('单选框组名（适用于 radio）'),
    required: z.boolean().optional().describe('是否必填（适用于 input、textarea、select、checkbox）'),
    style: z
      .record(z.unknown())
      .optional()
      .describe(
        '组件样式（仅布局和尺寸相关，不要包含颜色）。允许的属性：width, height, padding, margin, gap, flex, maxWidth, minWidth, maxHeight, minHeight, flexDirection, alignItems, justifyContent, display。禁止的属性：backgroundColor, color, border, borderColor 等颜色相关属性。系统会自动应用项目的设计系统颜色，无需手动指定。',
      ),
    children: z.array(a2uiComponentSchema).optional().describe('子组件列表（适用于 container、form、card 等容器组件）'),
    visible: z.boolean().optional().describe('是否可见，默认 true'),
    disabled: z.boolean().optional().describe('是否禁用，默认 false'),
    onEvent: z
      .array(
        z.object({
          type: z.string().describe('事件类型（如 click、change、submit）'),
          action: z.string().optional().describe('事件动作'),
          data: z.record(z.unknown()).optional().describe('事件数据'),
        }),
      )
      .optional()
      .describe('事件处理器列表'),
  }),
);

/**
 * Human-in-Loop 工具参数 Schema
 * 用于等待用户交互并获取用户输入
 */
export const humanInLoopParamsSchema = z.object({
  title: z.string().describe('界面标题，用于向用户说明需要做什么'),
  description: z.string().optional().describe('界面描述，提供更多上下文信息'),
  a2uiMessage: z
    .object({
      type: z
        .enum(['ui/init', 'ui/update', 'ui/append', 'ui/remove'])
        .default('ui/init')
        .describe('A2UI 消息类型：ui/init（初始化，最常用）、ui/update（更新）、ui/append（追加）、ui/remove（移除）'),
      id: z.string().optional().describe('消息 ID（可选），用于标识消息'),
      component: a2uiComponentSchema.optional().describe('单个 UI 组件对象（与 components 二选一）'),
      components: z.array(a2uiComponentSchema).optional().describe('多个 UI 组件数组（与 component 二选一）'),
      targetId: z.string().optional().describe('目标组件 ID（用于 update、append、remove 操作）'),
    })
    .describe(
      'A2UI 消息对象，包含要显示的 UI 组件。需要直接构造此对象。\n\n**基本结构**：\n- type: 消息类型，通常使用 "ui/init"\n- component: 单个组件对象（推荐）或 components: 组件数组\n- 组件必须包含 id 和 type 字段\n- 表单组件（form）通常作为容器，包含输入框、按钮等子组件\n\n**样式约束**：\n- style 属性中只能使用布局和尺寸相关属性（width, height, padding, margin, gap, flex 等）\n- 禁止使用颜色相关属性（backgroundColor, color, border, borderColor 等）\n- 按钮使用 variant 属性：primary、secondary、outline、ghost、danger\n- 文本使用 variant 属性：heading、body、caption、label\n\n**示例结构**：\n{\n  "type": "ui/init",\n  "component": {\n    "id": "form-container",\n    "type": "form",\n    "children": [\n      { "id": "name-input", "type": "input", "label": "姓名", "placeholder": "请输入姓名" },\n      { "id": "submit-btn", "type": "button", "label": "提交", "variant": "primary" }\n    ]\n  }\n}',
    ),
  required: z.boolean().default(true).describe('是否必须提交。如果为 false，用户可以选择取消'),
});

export type HumanInLoopParams = z.infer<typeof humanInLoopParamsSchema>;

export const humanInLoopSchema: ToolDefinition = {
  name: 'human_in_loop',
  description:
    '等待用户交互的工具。此工具会显示一个界面供用户填写/确认，用户提交后工具才会完成。\n\n**使用流程**：\n1. 构造 A2UI 消息对象（包含 type、component 或 components 字段），详见 a2uiMessage 参数说明\n2. 使用此工具，传入 A2UI 消息对象和标题描述\n3. 界面会显示给用户，等待用户填写/确认\n4. 用户提交后，工具完成，返回用户提交的数据（formData 中，键为组件的 id，值为用户输入）\n\n**适用场景**：\n- 需要用户填写表单（如收集用户信息、配置参数等）\n- 需要用户确认操作（如确认删除、确认支付等）\n- 需要用户提供额外信息（如补充缺失的参数）\n\n**重要样式约束**：\n- 在 style 属性中，只能使用布局和尺寸相关的属性（width, height, padding, margin, gap, flex, maxWidth, minWidth 等）\n- 禁止使用颜色相关属性（backgroundColor, color, border, borderColor 等）\n- 系统会自动应用项目的设计系统颜色，组件会自动匹配项目的视觉风格\n- 按钮使用 variant 属性控制样式：primary（默认）、secondary、outline、ghost、danger\n- 文本使用 variant 属性：heading、body（默认）、caption、label\n\n**注意**：这是一个阻塞性工具，会等待用户提交后才继续执行。',
  parameters: zodToJsonSchema(humanInLoopParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'ui',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        description: '用户提交的数据',
        properties: {
          submitted: { type: 'boolean', description: '用户是否提交（false 表示取消）' },
          formData: { type: 'object', description: '用户提交的表单数据' },
        },
      },
    },
  },
};
