// 生成类型枚举
export type GenerationType =
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'keyframe-to-video'
  | 'text-to-speech'
  | 'lip-sync'
  | 'music';

// 生成任务响应
export interface GenerationTaskResponse {
  success: boolean;
  taskId?: string;
  error?: string;
  data?: unknown;
}

export interface Music {
  url?: string;
  flac_url?: string;
  lyrics_sections?: {
    section_type: 'default' | 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'break' | 'outro';
    start: number;
    end: number;
    lines?: {
      start: number;
      end: number;
      text: number;
      words: { start: number; end: number; text: string }[];
    }[];
  }[];
}

export interface GenerationTaskResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: (
    | { sourceType: 'url' | 'base64' | 'hex' | 'song'; type: 'image' | 'video' | 'audio'; data: string; fileExtension?: `.${string}` }
    | { sourceType: 'music'; data: Music }
  )[];
  usage?: {
    image_count?: number;
    video_duration?: number;
    video_count?: number;
  };
  error?: string;
}
