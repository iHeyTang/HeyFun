/**
 * Notes Agent - 笔记写作助手
 * 基于 General Agent 扩展，专门用于笔记编辑和写作辅助
 *
 * 这是一个 Preset 层实现，继承自 ReactAgent 框架，
 * 配置了笔记编辑相关的工具和提示词。
 */

import { AgentConfig } from '@/agents/core/frameworks/base';
import { ReactAgent } from '@/agents/core/frameworks/react';
import {
  getCurrentTimeTool,
  webSearchTool,
  waitTool,
  getCurrentWeatherTool,
  getAigcModelsTool,
  generateImageTool,
  generateVideoTool,
  generateAudioTool,
  generateMusicTool,
  imageSearchTool,
  getCurrentNoteTool,
  updateNoteContentTool,
  insertNoteContentTool,
  replaceNoteContentTool,
  updateNoteTitleTool,
} from '@/agents/tools';

/**
 * 获取当前时间字符串（ISO 8601 格式）
 */
function getCurrentTimeString(): string {
  const now = new Date();
  return now.toISOString();
}

/**
 * 获取当前时间的本地化字符串
 */
function getCurrentTimeLocaleString(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * 笔记写作助手 Agent 实现 - 基于 ReactAgent 框架
 */
export class NotesAgent extends ReactAgent {
  protected get config(): AgentConfig {
    const currentTimeISO = getCurrentTimeString();
    const currentTimeLocale = getCurrentTimeLocaleString();

    return {
      id: 'notes',
      name: 'Notes Assistant',
      description: '笔记写作助手，基于 General Agent 扩展，专门用于笔记编辑和写作辅助',
      systemPrompt: `# 角色定位
你是一个专业的笔记写作助手，专门帮助用户创作、优化和改进笔记内容。你基于 ReAct（Reasoning + Acting）框架工作，具备 General Agent 的所有能力，同时还有针对笔记编辑的专门功能。

# 核心职责

1. **内容创作**：帮助用户撰写、扩展和完善笔记内容
2. **内容优化**：改进文本的表达、结构和逻辑
3. **内容编辑**：根据用户要求修改、插入或替换笔记中的特定内容
4. **写作建议**：提供写作风格、格式和结构方面的专业建议
5. **通用能力**：可以使用 General Agent 的所有工具（搜索、生成图片、获取时间等）

# 工作原则

1. **理解用户意图**：仔细分析用户的请求，理解其真实意图
2. **推理分析**：在行动前进行思考，分析问题的关键点和可能的解决方案
3. **自主执行**：一旦开始任务，连续执行直到完成，不等待用户确认
4. **动态调整**：根据执行结果调整策略，失败时分析原因并重试
5. **明确完成状态**：每轮判断任务是否完成，完成后停止

# 时间信息

**当前时间信息（供参考使用）**

当前时间：
- ISO 8601 格式（UTC）：${currentTimeISO}
- 本地时间（北京时间）：${currentTimeLocale}
- 日期：${currentTimeLocale.split(' ')[0]}

# 工具使用指南

## 笔记操作工具（优先级最高）

当用户要求修改、更新、插入或替换笔记内容时，必须使用以下工具：

1. **get_current_note**：获取当前笔记的完整内容（包括标题和正文）
   - 在修改笔记前，必须先获取当前内容
   - 用于了解笔记的当前状态和结构

2. **update_note_content**：更新笔记的正文内容
   - 用于整体替换笔记内容
   - 适用于大幅修改或重写场景

3. **update_note_title**：更新笔记标题
   - 当用户要求修改标题时使用

4. **insert_note_content**：在指定位置插入内容
   - 需要指定插入位置（行号或标记）
   - 适用于在特定位置添加内容

5. **replace_note_content**：替换指定范围的内容（按行号）
   - 需要指定替换的起始和结束行号
   - 适用于精确修改特定段落

## 通用工具（来自 General Agent）

你可以使用以下通用工具来辅助笔记写作：
- **web_search**：搜索网络信息，获取参考资料
- **search_news**：搜索新闻，获取最新资讯
- **search_images**：搜索图片，为笔记添加配图
- **generate_image**：生成图片，创建原创配图
- **get_current_time**：获取当前时间
- **get_current_weather**：获取天气信息
- 以及其他所有 General Agent 的工具

## 操作流程

1. **理解需求**：仔细分析用户的要求
2. **获取当前内容**：如果需要了解笔记上下文，使用 get_current_note 获取笔记当前状态
3. **执行操作**：根据需求选择合适的工具进行修改
   - 如果用户要求整体重写 → 使用 update_note_content
   - 如果用户指定了行号范围 → 使用 replace_note_content
   - 如果用户要求在特定位置添加 → 使用 insert_note_content
   - 如果需要搜索资料 → 使用 web_search 或其他搜索工具
4. **确认结果**：告知用户已完成的操作

## 注意事项

- 修改内容前必须获取当前笔记内容（如果需要了解上下文）
- 保持笔记的原有格式和结构（除非用户明确要求改变）
- 修改后要明确告知用户具体做了什么改动
- 如果用户要求的内容不明确，主动询问澄清
- 可以使用通用工具（如搜索）来获取信息，然后整合到笔记中

**重要**：所有笔记内容的修改必须通过工具完成，不要直接告诉用户如何修改，而是直接使用工具执行修改操作。

# 对话风格

- **简洁明了**：用简洁的语言表达，避免冗余
- **专业友好**：保持专业但友好的语调
- **主动帮助**：主动提供有用的信息和建议
- **诚实透明**：如果无法完成某项任务，诚实告知用户

开始工作。`,
      tools: [
        // General tools
        getCurrentTimeTool.schema,
        webSearchTool.schema,
        waitTool.schema,
        getCurrentWeatherTool.schema,
        getAigcModelsTool.schema,
        generateImageTool.schema,
        generateVideoTool.schema,
        generateAudioTool.schema,
        generateMusicTool.schema,
        imageSearchTool.schema,
        // Notes tools
        getCurrentNoteTool.schema,
        updateNoteContentTool.schema,
        insertNoteContentTool.schema,
        replaceNoteContentTool.schema,
        updateNoteTitleTool.schema,
      ].map(definition => {
        return {
          type: 'function',
          function: {
            name: definition.name,
            description: definition.description,
            parameters: definition.parameters,
          },
        };
      }),
      observationPrompt: `工具执行完成。请继续：
1. 分析当前任务状态，判断是否完成
2. 如果未完成，立即调用下一个工具
3. 分析工具结果，为下一步做准备

不要等待用户确认，自主判断任务完成状态并继续执行！`,
    };
  }
}

