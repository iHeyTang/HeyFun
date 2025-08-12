import {
  i2vSubmitParamsSchema,
  I2vSubmitResponse,
  kf2vSubmitParamsSchema,
  T2iSubmitResponse,
  t2iSubmitParamsSchema,
  t2vSubmitParamsSchema,
  Kf2vSubmitResponse,
  T2vSubmitResponse,
  t2iGetResultParamsSchema,
  T2iGetResultResponse,
  i2vGetResultParamsSchema,
  I2vGetResultResponse,
  kf2vGetResultParamsSchema,
  Kf2vGetResultResponse,
  t2vGetResultParamsSchema,
  T2vGetResultResponse,
} from '@/aigc/services/wan';
import { z } from 'zod';

const ALIYUN_DASHSCOPE_API_KEY = process.env.ALIYUN_DASHSCOPE_API_KEY;

export class DashscopeWanProvider {
  private apiKey: string;
  constructor() {
    this.apiKey = ALIYUN_DASHSCOPE_API_KEY!;
  }

  /**
   * 文生图
   * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2862677
   */
  async t2iSubmit(params: z.infer<typeof t2iSubmitParamsSchema>): Promise<T2iSubmitResponse> {
    const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'X-DashScope-Async': 'enable',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const data = await response.json();
    return data;
  }

  async t2iGetResult(params: z.infer<typeof t2iGetResultParamsSchema>): Promise<T2iGetResultResponse> {
    const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${params.task_id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const data = await response.json();
    return data;
  }

  /**
   * 图生视频(基于首帧)
   * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2867393
   */
  async i2vSubmit(params: z.infer<typeof i2vSubmitParamsSchema>): Promise<I2vSubmitResponse> {
    const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'X-DashScope-Async': 'enable',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const data = await response.json();
    return data;
  }

  async i2vGetResult(params: z.infer<typeof i2vGetResultParamsSchema>): Promise<I2vGetResultResponse> {
    const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${params.task_id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const data = await response.json();
    return data;
  }

  /**
   * 图生视频(基于首尾帧)
   * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2880649
   */
  async kf2vSubmit(params: z.infer<typeof kf2vSubmitParamsSchema>): Promise<Kf2vSubmitResponse> {
    const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'X-DashScope-Async': 'enable',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const data = await response.json();
    return data;
  }

  async kf2vGetResult(params: z.infer<typeof kf2vGetResultParamsSchema>): Promise<Kf2vGetResultResponse> {
    const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${params.task_id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const data = await response.json();
    return data;
  }

  /**
   * 文生视频
   * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2865250
   */
  async t2vSubmit(params: z.infer<typeof t2vSubmitParamsSchema>): Promise<T2vSubmitResponse> {
    const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'X-DashScope-Async': 'enable',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const data = await response.json();
    return data;
  }

  async t2vGetResult(params: z.infer<typeof t2vGetResultParamsSchema>): Promise<T2vGetResultResponse> {
    const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${params.task_id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const data = await response.json();
    return data;
  }
}
