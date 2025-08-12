import {
  seedance10ProGetResultParamsSchema,
  Seedance10ProGetResultResponse,
  seedance10ProSubmitParamsSchema,
  Seedance10ProSubmitResponse,
  seedEdit30I2iParamsSchema,
  SeedEdit30I2iResponse,
  seedream30T2iParamsSchema,
  Seedream30T2iResponse,
} from '../../services/doubao';
import z from 'zod';

const VOLCENGINE_ARK_ACCESS_KEY_ID = process.env.VOLCENGINE_ARK_ACCESS_KEY_ID;

export class VolcengineArkService {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = VOLCENGINE_ARK_ACCESS_KEY_ID!;
  }

  /**
   * 豆包视频生成API，包含多个版本的模型
   * Seedance 1.0 Pro | Seedance 1.0 Lite T2V | Seedance 1.0 Lite I2V
   * doubao-seaweed-241128 官网标记为【下线中】，故不再支持
   * https://www.volcengine.com/docs/82379/1330310#%E8%A7%86%E9%A2%91%E7%94%9F%E6%88%90%E8%83%BD%E5%8A%9B
   */
  async seedanceSubmit(params: z.infer<typeof seedance10ProSubmitParamsSchema>): Promise<Seedance10ProSubmitResponse> {
    const url = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json();
  }

  async seedanceGetResult(params: z.infer<typeof seedance10ProGetResultParamsSchema>): Promise<Seedance10ProGetResultResponse> {
    const url = `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${params.id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json();
  }

  /**
   * 图片生成API/图片编辑 SeedEdit 3.0 I2I
   * https://www.volcengine.com/docs/82379/1666946
   */
  async seedEdit30I2i(params: z.infer<typeof seedEdit30I2iParamsSchema>): Promise<SeedEdit30I2iResponse> {
    const url = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json();
  }

  /**
   * 图片生成API/文生图 Seedream 3.0 T2I
   * https://www.volcengine.com/docs/82379/1541523
   */
  async seedream30T2i(params: z.infer<typeof seedream30T2iParamsSchema>): Promise<Seedream30T2iResponse> {
    const url = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json();
  }
}
