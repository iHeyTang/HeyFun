import { ToAsyncTaskManager } from '../../utils/to-async-task';
import { BaseAigcModel, ImageToImageParams } from '../core/base-model';
import { seedEdit30I2iParamsSchema, VolcengineArkProvider } from '../providers/volcengine-ark';
import { GenerationTaskResult, GenerationType } from '../types';

const toAsync = new ToAsyncTaskManager<Awaited<ReturnType<VolcengineArkProvider['seedEdit30I2i']>>>();

/**
 * https://www.volcengine.com/docs/82379/1666946
 */
export class DoubaoSeededit30I2i250628 extends BaseAigcModel {
  name = 'doubao-seededit-3-0-i2i-250628';
  displayName = 'Doubao-Seededit-3.0-i2i';
  description = '准确遵循编辑指令，有效保留图像内容';
  parameterLimits = {
    generationType: ['image-to-image'] as GenerationType[],
  };

  submitParamsSchema = seedEdit30I2iParamsSchema;

  provider: VolcengineArkProvider;
  constructor(provider: VolcengineArkProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: ImageToImageParams): Promise<string> {
    const parsed = this.submitParamsSchema.safeParse({
      model: this.name,
      prompt: params.prompt,
      image: params.referenceImage,
      size: 'adaptive',
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    const task = toAsync.addTask(this.provider.seedEdit30I2i(parsed.data));
    return task.id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const result = toAsync.getTask(params.taskId);
    if (!result) {
      throw new Error('Task not found');
    }
    return {
      status: result.status === 'succeeded' ? 'completed' : result.status === 'failed' ? 'failed' : 'pending',
      data: result.result?.data?.map(item => ({ url: item.url, type: 'image' })) || [],
      usage: { image_count: result.result?.data?.length || 0 },
    };
  }
}
