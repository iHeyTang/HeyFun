import { ModelDefinition, ServiceAdapter, ModelRegistry } from './types';
import type { GenerationType } from '../../types';

/**
 * AIGC 模型注册表实现
 */
export class BuiltinModelRegistry implements ModelRegistry {
  private models: Map<string, ModelDefinition> = new Map();
  private adapters: Map<string, ServiceAdapter> = new Map();

  constructor() {
    this.initializeDefaultAdapters();
    this.initializeDefaultModels();
  }

  getModel(modelId: string): ModelDefinition | null {
    return this.models.get(modelId) || null;
  }

  getAvailableModels(): ModelDefinition[] {
    const availableModels: ModelDefinition[] = [];

    for (const model of this.models.values()) {
      // 检查是否有可用的服务商
      const bestProvider = this.getBestProvider(model.id);
      if (bestProvider) {
        availableModels.push(model);
      }
    }

    return availableModels;
  }

  getBestProvider(modelId: string): { adapter: ServiceAdapter; config: any } | null {
    const model = this.getModel(modelId);
    if (!model) return null;

    // 按优先级排序，选择第一个可用的服务商
    const sortedProviders = [...model.providers].sort((a, b) => a.priority - b.priority);

    for (const providerConfig of sortedProviders) {
      const adapter = this.adapters.get(providerConfig.id);
      if (adapter && this.isAdapterAvailable(adapter)) {
        return { adapter, config: providerConfig };
      }
    }

    return null;
  }

  registerModel(model: ModelDefinition): void {
    this.models.set(model.id, model);
  }

  registerAdapter(adapter: ServiceAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getModelsByType(generationType: GenerationType): ModelDefinition[] {
    return this.getAvailableModels().filter(model => model.supportedTypes.includes(generationType));
  }

  /**
   * 检查适配器是否可用（API密钥已配置）
   */
  private isAdapterAvailable(adapter: ServiceAdapter): boolean {
    const { env } = adapter;

    // 检查不同认证方式的环境变量
    switch (adapter.authMethod) {
      case 'api-key':
        return !!env.apiKey && !!process.env[env.apiKey];
      case 'access-key-secret':
        return !!env.accessKeyId && !!env.accessKeySecret && !!process.env[env.accessKeyId] && !!process.env[env.accessKeySecret];
      default:
        return false;
    }
  }

  /**
   * 初始化默认服务商适配器
   */
  private initializeDefaultAdapters(): void {
    const adapters: ServiceAdapter[] = [
      {
        id: 'wan',
        name: 'Dashscope Wan-X',
        authMethod: 'api-key',
        env: {
          apiKey: 'DASHSCOPE_API_KEY',
        },
        apiConfig: {
          endpoints: {
            text_to_image: {
              submit: '/api/v1/services/aigc/text2image/image-synthesis',
              result: '/api/v1/tasks/{task_id}',
            },
            text_to_video: {
              submit: '/api/v1/services/aigc/text2video/text-to-video',
              result: '/api/v1/tasks/{task_id}',
            },
            image_to_video: {
              submit: '/api/v1/services/aigc/image2video/image-to-video',
              result: '/api/v1/tasks/{task_id}',
            },
            keyframe_to_video: {
              submit: '/api/v1/services/aigc/keyframe2video/keyframe-to-video',
              result: '/api/v1/tasks/{task_id}',
            },
          },
          headers: {
            'Content-Type': 'application/json',
          },
          requestTransform: 'wanRequestTransform',
          responseTransform: 'wanResponseTransform',
        },
      },
      {
        id: 'doubao',
        name: 'Volcengine Doubao',
        authMethod: 'access-key-secret',
        env: {
          accessKeyId: 'VOLC_ACCESSKEY',
          accessKeySecret: 'VOLC_SECRETKEY',
        },
        apiConfig: {
          endpoints: {
            text_to_image: {
              submit: '/api/v1/text2image_v2/submit_task',
              result: '/api/v1/text2image_v2/get_result',
            },
            image_to_image: {
              submit: '/api/v1/img2img_v2/submit_task',
              result: '/api/v1/img2img_v2/get_result',
            },
            text_to_video: {
              submit: '/api/v1/text2video/submit_task',
              result: '/api/v1/text2video/get_result',
            },
            image_to_video: {
              submit: '/api/v1/img2video/submit_task',
              result: '/api/v1/img2video/get_result',
            },
            keyframe_to_video: {
              submit: '/api/v1/keyframe2video/submit_task',
              result: '/api/v1/keyframe2video/get_result',
            },
          },
          requestTransform: 'doubaoRequestTransform',
          responseTransform: 'doubaoResponseTransform',
        },
      },
      {
        id: 'jimeng',
        name: 'Volcengine Jimeng',
        authMethod: 'access-key-secret',
        env: {
          accessKeyId: 'VOLC_ACCESSKEY',
          accessKeySecret: 'VOLC_SECRETKEY',
        },
        apiConfig: {
          endpoints: {
            text_to_image: {
              submit: '/api/v1/text2image/submit_task',
              result: '/api/v1/text2image/get_result',
            },
            image_to_image: {
              submit: '/api/v1/img2img/submit_task',
              result: '/api/v1/img2img/get_result',
            },
            text_to_video: {
              submit: '/api/v1/text2video/submit_task',
              result: '/api/v1/text2video/get_result',
            },
            image_to_video: {
              submit: '/api/v1/img2video/submit_task',
              result: '/api/v1/img2video/get_result',
            },
          },
          requestTransform: 'jimengRequestTransform',
          responseTransform: 'jimengResponseTransform',
        },
      },
    ];

    adapters.forEach(adapter => this.registerAdapter(adapter));
  }

  /**
   * 初始化默认模型定义
   */
  private initializeDefaultModels(): void {
    const models: ModelDefinition[] = [
      {
        id: 'wan-x-ultra:free',
        name: 'Wan-X Ultra (Free)',
        description: '通义万相Ultra，文生图和图生图的最强模型',
        family: 'wan-x',
        supportedTypes: ['text-to-image', 'image-to-image'],
        aspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
        providers: [
          {
            id: 'wan',
            modelId: 'wanx-ultra-v1',
            priority: 1,
            pricing: {
              text_to_image: 0,
              image_to_image: 0,
              currency: 'CNY',
            },
          },
        ],
      },
      {
        id: 'wan-x-sketch-to-image:free',
        name: 'Wan-X Sketch to Image (Free)',
        description: '通义万相线稿上色，将黑白线稿转换为彩色图像',
        family: 'wan-x',
        supportedTypes: ['image-to-image'],
        aspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
        providers: [
          {
            id: 'wan',
            modelId: 'wanx-sketch-to-image-lite',
            priority: 1,
            pricing: {
              image_to_image: 0,
              currency: 'CNY',
            },
          },
        ],
      },
      {
        id: 'wan-x-v1:free',
        name: 'Wan-X V1 (Free)',
        description: '通义万相文生视频和图生视频模型',
        family: 'wan-x',
        supportedTypes: ['text-to-video', 'image-to-video', 'keyframe-to-video'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        durations: [5],
        providers: [
          {
            id: 'wan',
            modelId: 'wanx-v1',
            priority: 1,
            pricing: {
              text_to_video: 0,
              image_to_video: 0,
              keyframe_to_video: 0,
              currency: 'CNY',
            },
          },
        ],
      },
      {
        id: 'doubao-pro:free',
        name: 'Doubao Pro (Free)',
        description: '豆包图像生成Pro版本，支持文生图和图生图',
        family: 'doubao',
        supportedTypes: ['text-to-image', 'image-to-image'],
        aspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
        providers: [
          {
            id: 'doubao',
            modelId: 'general_v2.0_pro',
            priority: 1,
            pricing: {
              text_to_image: 0,
              image_to_image: 0,
              currency: 'CNY',
            },
          },
        ],
      },
      {
        id: 'doubao-video:free',
        name: 'Doubao Video (Free)',
        description: '豆包视频生成模型，支持文生视频和图生视频',
        family: 'doubao',
        supportedTypes: ['text-to-video', 'image-to-video', 'keyframe-to-video'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        durations: [2, 4],
        providers: [
          {
            id: 'doubao',
            modelId: 'general_v1.3_turbo',
            priority: 1,
            pricing: {
              text_to_video: 0,
              image_to_video: 0,
              keyframe_to_video: 0,
              currency: 'CNY',
            },
          },
        ],
      },
      {
        id: 'jimeng-4xl:free',
        name: 'Jimeng 4XL (Free)',
        description: '即梦4XL模型，支持高质量文生图和图生图',
        family: 'jimeng',
        supportedTypes: ['text-to-image', 'image-to-image'],
        aspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
        providers: [
          {
            id: 'jimeng',
            modelId: 'jimeng_4xl_v1',
            priority: 1,
            pricing: {
              text_to_image: 0,
              image_to_image: 0,
              currency: 'CNY',
            },
          },
        ],
      },
      {
        id: 'jimeng-video:free',
        name: 'Jimeng Video (Free)',
        description: '即梦视频生成模型，支持文本和图片生成视频',
        family: 'jimeng',
        supportedTypes: ['text-to-video', 'image-to-video'],
        aspectRatios: ['16:9', '9:16'],
        providers: [
          {
            id: 'jimeng',
            modelId: 'jimeng_video_v1',
            priority: 1,
            pricing: {
              text_to_video: 0,
              image_to_video: 0,
              currency: 'CNY',
            },
          },
        ],
      },
      {
        id: 'jimeng-xl:standard',
        name: 'Jimeng XL (Standard)',
        description: '即梦XL标准版，平衡质量与速度的图像生成模型',
        family: 'jimeng',
        supportedTypes: ['text-to-image', 'image-to-image'],
        aspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
        providers: [
          {
            id: 'jimeng',
            modelId: 'jimeng_xl_v1',
            priority: 2,
            pricing: {
              text_to_image: 0.01,
              image_to_image: 0.01,
              currency: 'CNY',
            },
          },
        ],
      },
    ];

    models.forEach(model => this.registerModel(model));
  }

  /**
   * 从配置文件加载模型定义（扩展点）
   */
  loadModelsFromConfig(configPath: string): void {
    // 未来可以从外部配置文件加载模型定义
    // 这样用户可以无需修改代码就添加新模型
  }

  /**
   * 获取所有可用的适配器
   */
  getAvailableAdapters(): ServiceAdapter[] {
    return Array.from(this.adapters.values()).filter(adapter => this.isAdapterAvailable(adapter));
  }
}
