// 类型定义
export type {
  GenerationType,
  BaseGenerationParams,
  TextToImageParams,
  ImageToImageParams,
  TextToVideoParams,
  ImageToVideoParams,
  KeyframeToVideoParams,
  ServiceModel,
  GenerationTaskRequest,
  GenerationTaskResponse,
  TaskStatus,
  ModelParameterLimits,
} from './types';

// 统一接口和适配器
export { BaseGenerationAdapter, WanAdapter, DoubaoAdapter, JimengAdapter, AdapterManager, aigcProviderConfigSchema } from './unified';

// 配置schema导出
export { volcengineArkServiceConfigSchema } from './providers/volcengine/ark';
export { volcengineJimengServiceConfigSchema } from './providers/volcengine/jimeng';
export { dashscopeWanServiceConfigSchema } from './providers/dashscope/wan';

// 原有服务导出
export { DoubaoService } from './services/doubao';
export { t2iGetResultParamsSchema as doubaoT2iGetResultParamsSchema } from './services/doubao';
export { t2iSubmitParamsSchema as doubaoT2iSubmitParamsSchema } from './services/doubao';
export { i2iGetResultParamsSchema as doubaoI2iGetResultParamsSchema } from './services/doubao';
export { i2iSubmitParamsSchema as doubaoI2iSubmitParamsSchema } from './services/doubao';
export { t2vGetResultParamsSchema as doubaoT2vGetResultParamsSchema } from './services/doubao';
export { t2vSubmitParamsSchema as doubaoT2vSubmitParamsSchema } from './services/doubao';
export { i2vGetResultParamsSchema as doubaoI2vGetResultParamsSchema } from './services/doubao';
export { i2vSubmitParamsSchema as doubaoI2vSubmitParamsSchema } from './services/doubao';
export { kf2vGetResultParamsSchema as doubaoKf2vGetResultParamsSchema } from './services/doubao';
export { kf2vSubmitParamsSchema as doubaoKf2vSubmitParamsSchema } from './services/doubao';

export { JimengService } from './services/jimeng';
export { t2iGetResultParamsSchema as jimengT2iGetResultParamsSchema } from './services/jimeng';
export { t2iSubmitParamsSchema as jimengT2iSubmitParamsSchema } from './services/jimeng';
export { i2iSubmitParamsSchema as jimengI2iSubmitParamsSchema } from './services/jimeng';
export { i2iGetResultParamsSchema as jimengI2iGetResultParamsSchema } from './services/jimeng';
export { t2vGetResultParamsSchema as jimengT2vGetResultParamsSchema } from './services/jimeng';
export { t2vSubmitParamsSchema as jimengT2vSubmitParamsSchema } from './services/jimeng';
export { i2vGetResultParamsSchema as jimengI2vGetResultParamsSchema } from './services/jimeng';
export { i2vSubmitParamsSchema as jimengI2vSubmitParamsSchema } from './services/jimeng';

export { WanService } from './services/wan';
export { t2iGetResultParamsSchema as wanT2iGetResultParamsSchema } from './services/wan';
export { t2iSubmitParamsSchema as wanT2iSubmitParamsSchema } from './services/wan';
export { t2vGetResultParamsSchema as wanT2vGetResultParamsSchema } from './services/wan';
export { t2vSubmitParamsSchema as wanT2vSubmitParamsSchema } from './services/wan';
export { i2vGetResultParamsSchema as wanI2vGetResultParamsSchema } from './services/wan';
export { i2vSubmitParamsSchema as wanI2vSubmitParamsSchema } from './services/wan';
export { kf2vGetResultParamsSchema as wanKf2vGetResultParamsSchema } from './services/wan';
export { kf2vSubmitParamsSchema as wanKf2vSubmitParamsSchema } from './services/wan';
