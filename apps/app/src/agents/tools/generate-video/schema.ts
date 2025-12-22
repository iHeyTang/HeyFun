import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const generateVideoSchema: ToolDefinition = {
  name: 'generate_video',
  description:
    '使用AI模型生成视频。支持文本生成视频（text-to-video）、图片生成视频（image-to-video）、视频转视频（video-to-video）和关键帧生成视频（keyframe-to-video）。生成的视频会保存在paintboard中。',
  parameters: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: '要使用的AI模型名称。使用get_aigc_models工具查看可用模型列表。',
      },
      prompt: {
        type: 'string',
        description: '视频生成的提示词，描述你想要生成的视频内容（可选，某些生成类型需要）',
      },
      firstFrame: {
        type: 'string',
        description: '首帧图片URL（可选），用于关键帧生成视频（keyframe-to-video）',
      },
      lastFrame: {
        type: 'string',
        description: '末帧图片URL（可选），用于关键帧生成视频（keyframe-to-video）',
      },
      referenceImage: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: '参考图片URL数组（可选），用于图片生成视频（image-to-video）',
      },
      video: {
        type: 'string',
        description: '参考视频URL（可选），用于视频转视频（video-to-video）',
      },
      audio: {
        type: 'string',
        description: '音频文件URL（可选），用于视频配音',
      },
      aspectRatio: {
        type: 'string',
        description: '视频宽高比（可选），例如：16:9, 1:1, 9:16等',
      },
      resolution: {
        type: 'string',
        description: '视频分辨率（可选），例如：720p, 1080p等',
      },
      duration: {
        type: 'string',
        description: '视频时长（可选），例如：5s, 10s等',
      },
      advanced: {
        type: 'object',
        description: '高级参数（可选），模型特定的额外参数',
      },
    },
    required: ['model'],
  },
  runtime: ToolRuntime.SERVER,
  category: 'aigc',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      taskId: { type: 'string', description: '任务ID，用于查询任务状态' },
      status: { type: 'string', description: '任务状态：pending, processing, completed, failed' },
      model: { type: 'string', description: '使用的模型名称' },
      generationType: { type: 'string', description: '生成类型：text-to-video, image-to-video, video-to-video, keyframe-to-video' },
      message: { type: 'string', description: '任务提交结果消息' },
    },
  },
};

