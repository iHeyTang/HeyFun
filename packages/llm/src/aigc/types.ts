// 生成类型枚举
export type GenerationType = 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video' | 'keyframe-to-video' | 'text-to-speech' | 'lip-sync';

// 生成任务响应
export interface GenerationTaskResponse {
  success: boolean;
  taskId?: string;
  error?: string;
  data?: unknown;
}

export interface GenerationTaskResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: { data: string; sourceType: 'url' | 'base64' | 'hex'; type: 'image' | 'video' | 'audio'; fileExtension?: `.${string}` }[];
  usage?: {
    image_count?: number;
    video_duration?: number;
    video_count?: number;
  };
  error?: string;
}
