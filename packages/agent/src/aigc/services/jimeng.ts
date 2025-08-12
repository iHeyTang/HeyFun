import { z } from 'zod';
import { VolcengineJimeng } from '../providers/volcengine/jimeng';

/**
 * 即梦文生图2.1
 */
export const jimengT2iV21ParamsSchema = z.object({
  req_key: z.literal('jimeng_high_aes_general_v21_L'),
  prompt: z.string(),
  seed: z.number().default(-1),
  width: z.number().min(256).max(768).default(512),
  height: z.number().min(256).max(768).default(512),
  use_pre_llm: z.boolean().default(true),
  use_sr: z.boolean().default(true),
  return_url: z.boolean().default(true),
  logo_info: z.object({
    add_logo: z.boolean().default(false),
    position: z.number().default(0),
    language: z.number().default(0),
    opacity: z.number().default(0.3),
    logo_text_content: z.string().default(''),
  }),
});

export interface JimengT2iV21Response {
  code: number;
  data: {
    algorithm_base_resp: {
      status_code: number;
      status_message: string;
    };
    binary_data_base64: [];
    image_urls: string[];
    infer_ctx: {
      algorithm_key: string;
      app_key: string;
      created_at: string;
      generate_id: string;
      log_id: string;
      params: {
        app_id: string;
        aspect_ratio: string;
        common_params: string;
        ddim_steps: number;
        edit_session_id: string;
        fps: number;
        frames: number;
        group_name: string;
        height: number;
        input_image_url: string;
        is_only_sr: boolean;
        is_pe: boolean;
        llm_result: string;
        media_source: string;
        n_samples: number;
        negative_prompt: string;
        ori_prompt: string;
        origin_request_id: string;
        output_height: number;
        output_width: number;
        pe_result: string;
        predict_tags_result: string;
        rephraser_result: string;
        req_key: string;
        rescale: number;
        resolution: string;
        scale: number;
        seed: number;
        shift: number;
        sr_img2img_fix_steps: number;
        sr_scale: number;
        sr_strength: number;
        sr_upscaler: string;
        steps: number;
        strength: number;
        trace_id: string;
        translate_negative_prompt: string;
        translate_prompt: string;
        use_pre_llm: boolean;
        use_prompt_aug: boolean;
        use_sr: boolean;
        version_id: string;
        video_url: string;
        vlm_edit: string;
        vlm_input: string;
        vlm_output: string;
        width: number;
      };
      request_id: string;
      session_id: string;
      time_stamp: string;
    };
    llm_result: string;
    pe_result: string;
    predict_tags_result: string;
    rephraser_result: string;
    request_id: string;
    vlm_result: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

/**
 * 即梦文生图3.0
 */
export const jimengT2iV30SubmitParamsSchema = z.object({
  req_key: z.literal('jimeng_t2i_v30'),
  prompt: z.string(),
  use_pre_llm: z.boolean().default(true),
  seed: z.number().default(-1),
  width: z.number().min(512).max(2048).default(1328),
  height: z.number().min(512).max(2048).default(1328),
});

export interface JimengT2iV30SubmitResponse {
  code: number;
  data: {
    task_id: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const jimengT2iV30GetResultParamsSchema = z.object({
  req_key: z.literal('jimeng_t2i_v30'),
  task_id: z.string(),
  req_json: z.string().transform<{
    logo_info?: {
      add_logo?: boolean;
      position?: number;
      language?: number;
      opacity?: number;
      logo_text_content?: string;
    };
    return_url?: boolean;
  }>(val => JSON.parse(val)),
});

export interface JimengT2iV30GetResultResponse {
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

/**
 * 即梦文生图3.1
 */
export const jimengT2iV31SubmitParamsSchema = z.object({
  req_key: z.literal('jimeng_t2i_v31'),
  prompt: z.string(),
  use_pre_llm: z.boolean().default(true),
  seed: z.number().default(-1),
  width: z.number().min(512).max(2048).default(1328),
  height: z.number().min(512).max(2048).default(1328),
});

export interface JimengT2iV31SubmitResponse {
  code: number;
  data: {
    task_id: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const jimengT2iV31GetResultParamsSchema = z.object({
  req_key: z.literal('jimeng_t2i_v31'),
  task_id: z.string(),
  req_json: z.string().transform<{
    logo_info?: {
      add_logo?: boolean;
      position?: number;
      language?: number;
      opacity?: number;
      logo_text_content?: string;
    };
    return_url?: boolean;
  }>(val => JSON.parse(val)),
});

export interface JimengT2iV31GetResultResponse {
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

/**
 * 即梦图生图3.0
 */
export const jimengI2iV30SubmitParamsSchema = z.object({
  req_key: z.literal('jimeng_i2i_v30'),
  binary_data_base64: z.array(z.string()).optional(),
  image_url: z.array(z.string()).optional(),
  prompt: z.string(),
  seed: z.number().default(-1),
  scale: z.number().min(0).max(1).default(0.5),
  width: z.number().min(512).max(2048).default(1328),
  height: z.number().min(512).max(2048).default(1328),
});

export interface JimengI2iV30SubmitResponse {
  code: number;
  data: {
    task_id: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const jimengI2iV30GetResultParamsSchema = z.object({
  req_key: z.literal('jimeng_i2i_v30'),
  task_id: z.string(),
  req_json: z.string().transform<{
    logo_info?: {
      add_logo?: boolean;
      position?: number;
      language?: number;
      opacity?: number;
      logo_text_content?: string;
    };
    return_url?: boolean;
  }>(val => JSON.parse(val)),
});

export interface JimengI2iV30GetResultResponse {
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

export const jimengt2vS20ProParamsSchema = z.object({
  req_key: z.literal('jimeng_vgfm_t2v_l20'),
  prompt: z.string(),
  seed: z.number().default(-1),
  aspect_ratio: z.enum(['16:9', '9:16', '4:3', '3:4', '21:9']).default('16:9'),
});

export interface Jimengt2vS20ProResponse {
  code: number;
  data: {
    task_id: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const jimengt2vS20ProGetResultParamsSchema = z.object({
  req_key: z.literal('jimeng_vgfm_t2v_l20'),
  task_id: z.string(),
});

export interface Jimengt2vS20ProGetResultResponse {
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

export const jimengi2vS20ProParamsSchema = z.object({
  req_key: z.literal('jimeng_vgfm_i2v_l20'),
  binary_data_base64: z.array(z.string()).optional(),
  image_urls: z.array(z.string()).optional(),
  prompt: z.string(),
  seed: z.number().default(-1),
  aspect_ratio: z.enum(['16:9', '9:16', '4:3', '3:4', '21:9']).default('16:9'),
});

export interface Jimengi2vS20ProResponse {
  code: number;
  data: {
    task_id: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const jimengi2vS20ProGetResultParamsSchema = z.object({
  req_key: z.literal('jimeng_vgfm_i2v_l20'),
  task_id: z.string(),
});

export interface Jimengi2vS20ProGetResultResponse {
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

  /**
   * 即梦文生图2.1
   * @param params
   */
  async t2iV21(params: z.infer<typeof jimengT2iV21ParamsSchema>) {
    const response = await this.volcengineJimeng.t2iV21(params);
    return response;
  }

  /**
   * 即梦文生图3.0
   * @param params
   */
  async t2iV30Submit(params: z.infer<typeof jimengT2iV30SubmitParamsSchema>) {
    const response = await this.volcengineJimeng.t2iV30Submit(params);
    return response;
  }

  async t2iV30GetResult(params: z.infer<typeof jimengT2iV30GetResultParamsSchema>) {
    const response = await this.volcengineJimeng.t2iV30GetResult(params);
    return response;
  }

  /**
   * 即梦文生图3.1
   * @param params
   */
  async t2iV31Submit(params: z.infer<typeof jimengT2iV31SubmitParamsSchema>) {
    const response = await this.volcengineJimeng.t2iV31Submit(params);
    return response;
  }

  async t2iV31GetResult(params: z.infer<typeof jimengT2iV31GetResultParamsSchema>) {
    const response = await this.volcengineJimeng.t2iV31GetResult(params);
    return response;
  }

  /**
   * 即梦图生图2.0
   * @param params
   */
  async i2iV30Submit(params: z.infer<typeof jimengI2iV30SubmitParamsSchema>) {
    const response = await this.volcengineJimeng.i2iV30Submit(params);
    return response;
  }

  async i2iV30GetResult(params: z.infer<typeof jimengI2iV30GetResultParamsSchema>) {
    const response = await this.volcengineJimeng.i2iV30GetResult(params);
    return response;
  }

  /**
   * 即梦图生视频S2.0Pro
   * @param params
   */
  async t2vS20Pro(params: z.infer<typeof jimengt2vS20ProParamsSchema>) {
    const response = await this.volcengineJimeng.t2vS20Pro(params);
    return response;
  }

  async t2vS20ProGetResult(params: z.infer<typeof jimengt2vS20ProGetResultParamsSchema>) {
    const response = await this.volcengineJimeng.t2vS20ProGetResult(params);
    return response;
  }

  /**
   * 即梦图生视频S2.0Pro
   * @param params
   */
  async i2vS20Pro(params: z.infer<typeof jimengi2vS20ProParamsSchema>) {
    const response = await this.volcengineJimeng.i2vS20Pro(params);
    return response;
  }

  async i2vS20ProGetResult(params: z.infer<typeof jimengi2vS20ProGetResultParamsSchema>) {
    const response = await this.volcengineJimeng.i2vS20ProGetResult(params);
    return response;
  }
}
