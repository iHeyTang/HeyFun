import z from 'zod';
import {
  BaseAigcModel,
  imageParamsSchema,
  SubmitTaskParams,
  submitTaskParamsSchema,
  t2aParamsSchema,
  videoParamsSchema,
  type ImageJsonSchema,
  type SubmitTaskParamsJsonSchema,
  type T2aJsonSchema,
  type VideoJsonSchema,
  type Voice,
  type VoiceCloneParams,
  type VoiceCloneResult,
} from './core/base-model';

import { GenerationTaskResult, GenerationType } from './types';
export { imageParamsSchema, submitTaskParamsSchema, t2aParamsSchema, videoParamsSchema };
export type {
  BaseAigcModel,
  GenerationTaskResult,
  GenerationType,
  ImageJsonSchema,
  SubmitTaskParams,
  SubmitTaskParamsJsonSchema,
  T2aJsonSchema,
  VideoJsonSchema,
  Voice,
  VoiceCloneParams,
  VoiceCloneResult,
};

// Providers
import { A302aiProvider, a302aiServiceConfigSchema } from './providers/a302ai';
import { DashscopeWanProvider, dashscopeWanServiceConfigSchema } from './providers/aliyun-dashscope';
import { MinimaxProvider, minimaxServiceConfigSchema } from './providers/minimax';
import { VolcengineArkProvider, volcengineArkServiceConfigSchema } from './providers/volcengine-ark';
import { VolcengineJimengProvider, volcengineJimengServiceConfigSchema } from './providers/volcengine-jimeng';

// 豆包模型
import { DoubaoSeedance10LiteVideo } from './models/doubao-seedance-1-0-lite-video';
import { DoubaoSeedance10Pro250528 } from './models/doubao-seedance-1-0-pro-250528';
import { DoubaoSeededit30I2i250628 } from './models/doubao-seededit-3-0-i2i-250628';
import { DoubaoSeedream30T2i250415 } from './models/doubao-seedream-3-0-t2i-250415';
import { DoubaoSeedream40 } from './models/doubao-seedream-4-0-250828';

// 即梦模型

// Minimax
import { Gemini25FlashImagePreview } from './models/gemini-2-5-flash-image-preview';
import { Kling21 } from './models/kling-2-1';
import { MidjourneyV7 } from './models/midjourney-v7';
import { Minimax25Speech } from './models/minimax-2-5-speech';
import { PixverseLipsync } from './models/pixverse-lipsync';
import { SoraVideo2 } from './models/sora-video-2';
import { SyncSoV2 } from './models/sync-so-v2';

const aigcProviderConfigSchema = z.object({
  doubao: volcengineArkServiceConfigSchema.optional(),
  jimeng: volcengineJimengServiceConfigSchema.optional(),
  wan: dashscopeWanServiceConfigSchema.optional(),
  minimax: minimaxServiceConfigSchema.optional(),
  '302ai': a302aiServiceConfigSchema.optional(),
});

class AIGCHost {
  private models: Map<string, BaseAigcModel> = new Map();
  public providers: {
    'dashscope-wan'?: DashscopeWanProvider;
    'volcengine-ark'?: VolcengineArkProvider;
    'volcengine-jimeng'?: VolcengineJimengProvider;
    minimax?: MinimaxProvider;
    '302ai'?: A302aiProvider;
  } = {};

  constructor(config: z.infer<typeof aigcProviderConfigSchema>) {
    if (config.wan) {
      const provider = new DashscopeWanProvider(config.wan);
      this.providers['dashscope-wan'] = provider;
    }
    if (config.doubao) {
      const provider = new VolcengineArkProvider(config.doubao);
      this.providers['volcengine-ark'] = provider;
    }
    if (config.jimeng) {
      const provider = new VolcengineJimengProvider(config.jimeng);
      this.providers['volcengine-jimeng'] = provider;
    }
    if (config.minimax) {
      const provider = new MinimaxProvider(config.minimax);
      this.providers['minimax'] = provider;
    }
    if (config['302ai']) {
      const provider = new A302aiProvider(config['302ai']);
      this.providers['302ai'] = provider;
    }
  }

  // 获取所有服务模型信息
  public async getAllServiceModels(): Promise<BaseAigcModel[]> {
    return Array.from(this.models.values());
  }

  // 提交生成任务
  public async submitGenerationTask(modelName: string, params: SubmitTaskParams): Promise<string> {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`不支持的服务: ${modelName}`);
    }
    return await model.submitTask(params);
  }

  // 获取任务结果
  public async getTaskResult(params: { modelName: string; taskId: string; params: SubmitTaskParams }): Promise<GenerationTaskResult> {
    const { modelName, taskId } = params;
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`不支持的服务: ${modelName}`);
    }

    return await model.getTaskResult({ model: modelName, taskId, params: params.params });
  }

  public async registerModel(fn: (providers: typeof this.providers) => BaseAigcModel | null): Promise<void> {
    const model = fn(this.providers);
    if (!model) {
      return;
    }
    this.models.set(model.name, model);
  }

  // 获取模型实例
  public getModel(modelName: string): BaseAigcModel | null {
    return this.models.get(modelName) || null;
  }
}

const AIGC = new AIGCHost({
  wan: {
    apiKey: process.env.ALIYUN_DASHSCOPE_API_KEY || '',
  },
  doubao: {
    apiKey: process.env.VOLCENGINE_ARK_ACCESS_KEY_ID || '',
  },
  jimeng: {
    accessKeyId: process.env.VOLCENGINE_JIMENG_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.VOLCENGINE_JIMENG_SECRET_ACCESS_KEY || '',
  },
  minimax: {
    apiKey: process.env.MINIMAX_API_KEY || '',
  },
  '302ai': {
    apiKey: process.env.A302AI_API_KEY || '',
  },
});

// 豆包模型注册
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedance10LiteVideo(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedance10Pro250528(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeededit30I2i250628(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedream30T2i250415(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedream40(providers['volcengine-ark']) : null));

// 即梦模型注册
// TODO: 即梦模型暂时不可用，存在 bug，待修复后重新启用
// AIGC.registerModel(providers => (providers['volcengine-jimeng'] ? new Jimeng40(providers['volcengine-jimeng']) : null));
// AIGC.registerModel(providers => (providers['volcengine-jimeng'] ? new Jimeng30ProVideo(providers['volcengine-jimeng']) : null));

// Minimax模型注册
AIGC.registerModel(providers => (providers['minimax'] ? new Minimax25Speech(providers['minimax']) : null));

// Midjourney模型注册
AIGC.registerModel(providers => (providers['302ai'] ? new MidjourneyV7(providers['302ai']) : null));

// Kling模型注册
AIGC.registerModel(providers => (providers['302ai'] ? new Kling21(providers['302ai']) : null));

// Gemini模型注册
AIGC.registerModel(providers => (providers['302ai'] ? new Gemini25FlashImagePreview(providers['302ai']) : null));

// Sora模型注册
AIGC.registerModel(providers => (providers['302ai'] ? new SoraVideo2(providers['302ai']) : null));

// Sync So V2模型注册
AIGC.registerModel(providers => (providers['302ai'] ? new SyncSoV2(providers['302ai']) : null));

// Pixverse Lipsync模型注册
AIGC.registerModel(providers => (providers['302ai'] ? new PixverseLipsync(providers['302ai']) : null));

export default AIGC;
