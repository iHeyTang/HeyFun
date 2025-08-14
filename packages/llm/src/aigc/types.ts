// 生成类型枚举
export type GenerationType = 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video' | 'keyframe-to-video';

// 画幅大小接口
export interface CanvasSize {
  width: number;
  height: number;
}

// 画幅大小限制
export interface CanvasSizeLimits {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  step: number; // 步长，用于调整画幅大小
  aspectRatio?: string[]; // 支持的宽高比，如 ['1:1', '16:9', '4:3']
}

// 模型参数限制
export interface ModelParameterLimits {
  canvasSize: CanvasSizeLimits;
  duration?: number[];
}

// 基础生成参数接口
export interface BaseGenerationParams {
  prompt: string; // 提示词
}

// 文生图参数
export interface TextToImageParams extends BaseGenerationParams {
  canvasSize: CanvasSize;
}

// 图生图参数
export interface ImageToImageParams extends BaseGenerationParams {
  referenceImage: string; // 参考图（base64或URL）
  canvasSize: CanvasSize;
}

// 文生视频参数
export interface TextToVideoParams extends BaseGenerationParams {
  canvasSize: CanvasSize;
  duration: number; // 时长（秒）
}

// 图生视频参数
export interface ImageToVideoParams extends BaseGenerationParams {
  referenceImage: string; // 参考图（base64或URL）
  canvasSize: CanvasSize;
  duration: number; // 时长（秒）
}

// 首尾帧生视频参数
export interface KeyframeToVideoParams extends BaseGenerationParams {
  firstFrame: string; // 首帧（base64或URL）
  lastFrame: string; // 尾帧（base64或URL）
  canvasSize: CanvasSize;
  duration: number; // 时长（秒）
}

// 服务模型信息
export interface ServiceModel {
  service: string;
  model: string;
  displayName: string;
  generationType: GenerationType;
  description?: string;
  parameterLimits?: ModelParameterLimits; // 模型参数限制
}

// 生成任务请求
export interface GenerationTaskRequest {
  service: string;
  model: string;
  generationType: GenerationType;
  params: TextToImageParams | ImageToImageParams | TextToVideoParams | ImageToVideoParams | KeyframeToVideoParams;
}

// 生成任务响应
export interface GenerationTaskResponse {
  success: boolean;
  taskId?: string;
  error?: string;
  data?: unknown;
}

// 生成任务结果
export interface GenerationTaskUsage {
  image_count?: number;
  video_duration?: number;
  video_count?: number;
}

export interface GenerationTaskResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: { url: string; type: 'image' | 'video' }[];
  usage?: GenerationTaskUsage;
  error?: string;
}

// 任务状态
export interface TaskStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: unknown;
  error?: string;
}
