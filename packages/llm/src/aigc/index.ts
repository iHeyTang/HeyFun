import z from 'zod';
import { BaseAigcModel, BaseAigcModelInfo, ModelParameterLimits, SubmitTaskParams } from './core/base-model';
import { DashscopeWanProvider, dashscopeWanServiceConfigSchema } from './providers/aliyun-dashscope';
import { VolcengineArkProvider, volcengineArkServiceConfigSchema } from './providers/volcengine-ark';
import { VolcengineJimengProvider, volcengineJimengServiceConfigSchema } from './providers/volcengine-jimeng';
import { GenerationTaskResult, GenerationType } from './types';

// 豆包模型
import { DoubaoSeedance10LiteI2v250428 } from './models/doubao-seedance-1-0-lite-i2v-250428';
import { DoubaoSeedance10Pro250528 } from './models/doubao-seedance-1-0-pro-250528';
import { DoubaoSeededit30I2i250628 } from './models/doubao-seededit-3-0-i2i-250628';
import { DoubaoSeedance10LiteT2v250428 } from './models/doubao-seedance-1-0-lite-t2v-250428';
import { DoubaoSeedream30T2i250415 } from './models/doubao-seedream-3-0-t2i-250415';

// 即梦模型
import { JimengI2iV30 } from './models/jimeng-i2i-v30';
import { JimengT2iV30 } from './models/jimeng-t2i-v30';
import { JimengVgfmI2vL20 } from './models/jimeng-vgfm-i2v-l20';
import { JimengVgfmT2vL20 } from './models/jimeng-vgfm-t2v-l20';
import { JimengT2iV31 } from './models/jiment-t2i-v31';

// 万相模型
import { Wan22I2vFlash } from './models/wan2.2-i2v-flash';
import { Wan22I2vPlus } from './models/wan2.2-i2v-plus';
import { Wan22T2iFlash } from './models/wan2.2-t2i-flash';
import { Wan22T2iPlus } from './models/wan2.2-t2i-plus';
import { Wan22T2vPlus } from './models/wan2.2-t2v-plus';
import { Wanx20T2iTurbo } from './models/wanx2.0-t2i-turbo';
import { Wanx21I2vPlus } from './models/wanx2.1-i2v-plus';
import { Wanx21I2vTurbo } from './models/wanx2.1-i2v-turbo';
import { Wanx21Kf2vPlus } from './models/wanx2.1-kf2v-plus';
import { Wanx21T2iPlus } from './models/wanx2.1-t2i-plus';
import { Wanx21T2iTurbo } from './models/wanx2.1-t2i-turbo';
import { Wanx21T2vPlus } from './models/wanx2.1-t2v-plus';
import { Wanx21T2vTurbo } from './models/wanx2.1-t2v-turbo';

const aigcProviderConfigSchema = z.object({
  doubao: volcengineArkServiceConfigSchema.optional(),
  jimeng: volcengineJimengServiceConfigSchema.optional(),
  wan: dashscopeWanServiceConfigSchema.optional(),
});

export const GENERATION_TYPES: { value: GenerationType; label: string; description: string }[] = [
  { value: 'text-to-image', label: 'Text to Image', description: 'Generate images from text descriptions' },
  { value: 'image-to-image', label: 'Image to Image', description: 'Generate new images from reference images and text descriptions' },
  { value: 'text-to-video', label: 'Text to Video', description: 'Generate videos from text descriptions' },
  { value: 'image-to-video', label: 'Image to Video', description: 'Generate videos from reference images and text descriptions' },
  { value: 'keyframe-to-video', label: 'Keyframe to Video', description: 'Generate videos from first and last frames and text descriptions' },
];

class AIGCHost {
  private models: Map<string, BaseAigcModel> = new Map();
  public providers: {
    'dashscope-wan'?: DashscopeWanProvider;
    'volcengine-ark'?: VolcengineArkProvider;
    'volcengine-jimeng'?: VolcengineJimengProvider;
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
  }

  // 获取所有服务模型信息
  public async getAllServiceModels(): Promise<BaseAigcModelInfo[]> {
    return Array.from(this.models.values());
  }

  // 根据生成类型获取对应的模型
  public async getModelsByGenerationType(generationType: GenerationType): Promise<BaseAigcModel[]> {
    return Array.from(this.models.values()).filter(model => model.parameterLimits?.generationType?.includes(generationType));
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
  public async getTaskResult(params: { modelName: string; taskId: string }): Promise<GenerationTaskResult> {
    const { modelName, taskId } = params;
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`不支持的服务: ${modelName}`);
    }

    return await model.getTaskResult({ taskId });
  }

  public async registerModel(fn: (providers: typeof this.providers) => BaseAigcModel | null): Promise<void> {
    const model = fn(this.providers);
    if (!model) {
      return;
    }
    this.models.set(model.name, model);
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
});

// 豆包模型注册
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedance10LiteI2v250428(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedance10Pro250528(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeededit30I2i250628(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedance10LiteT2v250428(providers['volcengine-ark']) : null));
AIGC.registerModel(providers => (providers['volcengine-ark'] ? new DoubaoSeedream30T2i250415(providers['volcengine-ark']) : null));

// 即梦模型注册
AIGC.registerModel(providers => (providers['volcengine-jimeng'] ? new JimengI2iV30(providers['volcengine-jimeng']) : null));
AIGC.registerModel(providers => (providers['volcengine-jimeng'] ? new JimengT2iV30(providers['volcengine-jimeng']) : null));
AIGC.registerModel(providers => (providers['volcengine-jimeng'] ? new JimengVgfmI2vL20(providers['volcengine-jimeng']) : null));
AIGC.registerModel(providers => (providers['volcengine-jimeng'] ? new JimengVgfmT2vL20(providers['volcengine-jimeng']) : null));
AIGC.registerModel(providers => (providers['volcengine-jimeng'] ? new JimengT2iV31(providers['volcengine-jimeng']) : null));

// 万相模型注册
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wan22I2vFlash(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wan22I2vPlus(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wan22T2iFlash(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wan22T2iPlus(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wan22T2vPlus(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wanx20T2iTurbo(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wanx21I2vPlus(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wanx21I2vTurbo(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wanx21Kf2vPlus(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wanx21T2iPlus(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wanx21T2iTurbo(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wanx21T2vPlus(providers['dashscope-wan']) : null));
AIGC.registerModel(providers => (providers['dashscope-wan'] ? new Wanx21T2vTurbo(providers['dashscope-wan']) : null));

export default AIGC;
export type { GenerationType, BaseAigcModel, BaseAigcModelInfo, ModelParameterLimits };
