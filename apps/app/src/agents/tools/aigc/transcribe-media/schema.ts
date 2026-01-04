import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 音视频转文本的参数 Schema
 */
export const transcribeMediaParamsSchema = z.object({
  fileUrl: z.string().min(1).describe('音视频文件的URL。支持OSS文件路径（oss://fileKey）或完整的HTTP/HTTPS URL。'),
  model: z.string().optional().describe('语音识别模型名称（可选）。如果不指定，将自动选择可用的语音识别模型。使用get_aigc_models工具查看可用模型列表。'),
  outputFormat: z.enum(['text', 'srt']).default('text').describe('输出格式：text（纯文本）或 srt（字幕文件格式）'),
  language: z.string().optional().describe('音频语言代码（可选），例如：zh、en、ja等。如果不指定，将自动检测语言。'),
  prompt: z.string().optional().describe('提示词（可选），用于指导转写，例如专业术语、人名等。'),
});

export type TranscribeMediaParams = z.infer<typeof transcribeMediaParamsSchema>;

export const transcribeMediaSchema: ToolDefinition = {
  name: 'transcribe_media',
  description: '将音视频文件转换为文本或字幕（SRT格式）。支持音频和视频文件，自动识别语言并生成转写文本。',
  displayName: {
    en: 'Transcribe Media',
    'zh-CN': '音视频转文本',
    'zh-TW': '音視頻轉文本',
    ja: 'メディア文字起こし',
    ko: '미디어 전사',
  },
  parameters: zodToJsonSchema(transcribeMediaParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'aigc',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      text: { type: 'string', description: '转写的文本内容' },
      srt: { type: 'string', description: 'SRT格式的字幕内容（当outputFormat为srt时）' },
      language: { type: 'string', description: '检测到的语言代码' },
      duration: { type: 'number', description: '音视频时长（秒）' },
      error: { type: 'string', description: '错误信息（如果失败）' },
    },
  },
  manual: `使用此工具将音视频文件转换为文本或字幕。

**输入参数**：
- fileUrl: 音视频文件的URL，支持：
  - OSS路径格式：oss://fileKey
  - 完整URL：https://example.com/audio.mp3
- outputFormat: 输出格式
  - text: 纯文本格式
  - srt: SRT字幕格式（包含时间戳）
- language: 可选，指定语言代码（如：zh、en、ja），不指定则自动检测
- prompt: 可选，提示词，用于指导转写（如专业术语、人名等）

**输出**：
- 成功时返回转写的文本或SRT字幕
- 失败时返回错误信息

**注意事项**：
- 支持常见音视频格式：mp3, wav, m4a, mp4, avi, mov等
- 文件大小建议不超过25MB
- 转写时间取决于文件长度，可能需要等待`,
};

