// 统一AI生成服务接口
export { AdapterManager, aigcProviderConfigSchema } from './adapter-manager';
export { BaseGenerationAdapter } from './core/base-adapter';
export { WanAdapter } from './adapters/wan-adapter';
export { DoubaoAdapter } from './adapters/doubao-adapter';
export { JimengAdapter } from './adapters/jimeng-adapter';

// 重新导出类型
export type {
  GenerationType,
  TextToImageParams,
  ImageToImageParams,
  TextToVideoParams,
  ImageToVideoParams,
  KeyframeToVideoParams,
  GenerationTaskResponse,
  TaskStatus,
  ServiceModel,
} from '../types';
