import { z } from 'zod';
import { VolcengineJimeng } from '../providers/volcengine/jimeng';

export const t2iSubmitParamsSchema = z.discriminatedUnion('req_key', [
  z.object({
    req_key: z.literal('jimeng_t2i_v30'),
    prompt: z.string(),
    use_pre_llm: z.boolean().default(true),
    seed: z.number().default(-1),
    width: z.number().min(512).max(2048).default(1328),
    height: z.number().min(512).max(2048).default(1328),
  }),
  z.object({
    req_key: z.literal('jimeng_t2i_v31'),
    prompt: z.string(),
    use_pre_llm: z.boolean().default(true),
    seed: z.number().default(-1),
    width: z.number().min(512).max(2048).default(1328),
    height: z.number().min(512).max(2048).default(1328),
  }),
]);

export interface T2iSubmitResponse {
  code: number;
  data: {
    task_id: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

const reqJsonSchema = z
  .object({
    logo_info: z
      .object({
        add_logo: z.boolean().optional(),
        position: z.number().optional(),
        language: z.number().optional(),
        opacity: z.number().optional(),
        logo_text_content: z.string().optional(),
      })
      .optional(),
    return_url: z.boolean().optional(),
  })
  .optional();

export const t2iGetResultParamsSchema = z.discriminatedUnion('req_key', [
  z.object({
    req_key: z.literal('jimeng_t2i_v30'),
    task_id: z.string(),
    req_json: reqJsonSchema.transform<string>(val => JSON.stringify(val)),
  }),
  z.object({
    req_key: z.literal('jimeng_t2i_v31'),
    task_id: z.string(),
    req_json: reqJsonSchema.transform<string>(val => JSON.stringify(val)),
  }),
]);

export interface T2iGetResultResponse {
  code: number;
  data: {
    binary_data_base64: string[];
    image_urls: string[];
    status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired';
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const i2iSubmitParamsSchema = z.discriminatedUnion('req_key', [
  z.object({
    req_key: z.literal('jimeng_i2i_v30'),
    binary_data_base64: z.array(z.string()).optional(),
    image_url: z.array(z.string()).optional(),
    prompt: z.string(),
    seed: z.number().default(-1),
    scale: z.number().min(0).max(1).default(0.5),
    width: z.number().min(512).max(2048).default(1328),
    height: z.number().min(512).max(2048).default(1328),
  }),
]);

export const i2iGetResultParamsSchema = z.discriminatedUnion('req_key', [
  z.object({
    req_key: z.literal('jimeng_i2i_v30'),
    task_id: z.string(),
    req_json: reqJsonSchema.transform<string>(val => JSON.stringify(val)),
  }),
]);

export interface I2iSubmitResponse {
  code: number;
  data: {
    binary_data_base64: string[];
    image_urls: string[];
    status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired';
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const t2vSubmitParamsSchema = z.discriminatedUnion('req_key', [
  z.object({
    req_key: z.literal('jimeng_vgfm_t2v_l20'),
    prompt: z.string(),
    seed: z.number().default(-1),
    aspect_ratio: z.enum(['16:9', '9:16', '4:3', '3:4', '21:9']).default('16:9'),
  }),
]);

export interface T2vSubmitResponse {
  code: number;
  data: {
    status: number;
    video_url: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const t2vGetResultParamsSchema = z.discriminatedUnion('req_key', [
  z.object({
    req_key: z.literal('jimeng_vgfm_t2v_l20'),
    task_id: z.string(),
  }),
]);

export interface T2vGetResultResponse {
  code: number;
  data: {
    status: number;
    video_url: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const i2vSubmitParamsSchema = z.discriminatedUnion('req_key', [
  z.object({
    req_key: z.literal('jimeng_vgfm_i2v_l20'),
    binary_data_base64: z.array(z.string()).optional(),
    image_urls: z.array(z.string()).optional(),
    prompt: z.string(),
    seed: z.number().default(-1),
    aspect_ratio: z.enum(['16:9', '9:16', '4:3', '3:4', '21:9']).default('16:9'),
  }),
]);

export interface I2vSubmitResponse {
  code: number;
  data: {
    task_id: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const i2vGetResultParamsSchema = z.discriminatedUnion('req_key', [
  z.object({
    req_key: z.literal('jimeng_vgfm_i2v_l20'),
    task_id: z.string(),
  }),
]);

export interface I2vGetResultResponse {
  code: number;
  data: {
    status: number;
    video_url: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export class JimengService {
  private readonly volcengineJimeng: VolcengineJimeng;

  constructor() {
    this.volcengineJimeng = new VolcengineJimeng();
  }

  async t2iSubmit(params: z.infer<typeof t2iSubmitParamsSchema>) {
    if (params.req_key === 'jimeng_t2i_v30') {
      return this.volcengineJimeng.t2iV30Submit(params);
    }
    if (params.req_key === 'jimeng_t2i_v31') {
      return this.volcengineJimeng.t2iV31Submit(params);
    }
    throw new Error('Invalid request key');
  }

  async t2iGetResult(params: z.infer<typeof t2iGetResultParamsSchema>) {
    if (params.req_key === 'jimeng_t2i_v30') {
      return this.volcengineJimeng.t2iV30GetResult(params);
    }
    if (params.req_key === 'jimeng_t2i_v31') {
      return this.volcengineJimeng.t2iV31GetResult(params);
    }
    throw new Error('Invalid request key');
  }

  async i2iSubmit(params: z.infer<typeof i2iSubmitParamsSchema>) {
    if (params.req_key === 'jimeng_i2i_v30') {
      return this.volcengineJimeng.i2iV30Submit(params);
    }
    throw new Error('Invalid request key');
  }

  async i2iGetResult(params: z.infer<typeof i2iGetResultParamsSchema>) {
    if (params.req_key === 'jimeng_i2i_v30') {
      return this.volcengineJimeng.i2iV30GetResult(params);
    }
    throw new Error('Invalid request key');
  }

  async t2vSubmit(params: z.infer<typeof t2vSubmitParamsSchema>) {
    if (params.req_key === 'jimeng_vgfm_t2v_l20') {
      return this.volcengineJimeng.t2vS20Pro(params);
    }
    throw new Error('Invalid request key');
  }

  async t2vGetResult(params: z.infer<typeof t2vGetResultParamsSchema>) {
    if (params.req_key === 'jimeng_vgfm_t2v_l20') {
      return this.volcengineJimeng.t2vS20ProGetResult(params);
    }
    throw new Error('Invalid request key');
  }

  async i2vSubmit(params: z.infer<typeof i2vSubmitParamsSchema>) {
    if (params.req_key === 'jimeng_vgfm_i2v_l20') {
      return this.volcengineJimeng.i2vS20Pro(params);
    }
    throw new Error('Invalid request key');
  }

  async i2vGetResult(params: z.infer<typeof i2vGetResultParamsSchema>) {
    if (params.req_key === 'jimeng_vgfm_i2v_l20') {
      return this.volcengineJimeng.i2vS20ProGetResult(params);
    }
    throw new Error('Invalid request key');
  }
}
