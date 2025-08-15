import crypto from 'crypto';
import fetch from 'node-fetch';
import qs from 'querystring';
import { z } from 'zod';

const VOLCENGINE_JIMENG_ACCESS_KEY_ID = process.env.VOLCENGINE_JIMENG_ACCESS_KEY_ID;
const VOLCENGINE_JIMENG_SECRET_ACCESS_KEY = process.env.VOLCENGINE_JIMENG_SECRET_ACCESS_KEY;

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

/**
 * {
 *   logo_info?: {
 *     add_logo?: boolean;
 *     position?: number;
 *     language?: number;
 *     opacity?: number;
 *     logo_text_content?: string;
 *   };
 *   return_url?: boolean;
 * }
 * @param val
 * @returns
 */
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

export const jimengT2iV30GetResultParamsSchema = z.object({
  req_key: z.literal('jimeng_t2i_v30'),
  task_id: z.string(),
  req_json: reqJsonSchema.transform<string>(val => JSON.stringify(val)),
});

export interface JimengT2iV30GetResultResponse {
  code: number;
  data: {
    binary_data_base64: string[];
    image_urls?: string[];
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
  req_json: reqJsonSchema.transform<string>(val => JSON.stringify(val)),
});

export interface JimengT2iV31GetResultResponse {
  code: number;
  data: {
    binary_data_base64: string[];
    image_urls?: string[];
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
  req_json: reqJsonSchema.transform<string>(val => JSON.stringify(val)),
});

export interface JimengI2iV30GetResultResponse {
  code: number;
  data: {
    binary_data_base64: string[];
    image_urls?: string[];
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
    status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired';
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
    status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired';
    video_url: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const volcengineJimengServiceConfigSchema = z.object({
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
});

export class VolcengineJimeng {
  public readonly homePage = 'https://jimeng.jianying.com/';
  private readonly signer: Signer;

  constructor(config: z.infer<typeof volcengineJimengServiceConfigSchema>) {
    this.signer = new Signer(config.accessKeyId, config.secretAccessKey, 'cv', 'cn-north-1');
  }

  /**
   * 即梦文生图2.1
   */
  async t2iV21(params: z.infer<typeof jimengT2iV21ParamsSchema>): Promise<JimengT2iV21Response> {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVProcess';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as JimengT2iV21Response;
    return data;
  }

  /**
   * 即梦文生图3.0
   */
  async t2iV30Submit(params: z.infer<typeof jimengT2iV30SubmitParamsSchema>): Promise<JimengT2iV30SubmitResponse> {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncSubmitTask';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as JimengT2iV30SubmitResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }

  async t2iV30GetResult(params: z.infer<typeof jimengT2iV30GetResultParamsSchema>): Promise<JimengT2iV30GetResultResponse> {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncGetResult';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as JimengT2iV30GetResultResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }

  /**
   * 即梦文生图3.1
   */
  async t2iV31Submit(params: z.infer<typeof jimengT2iV31SubmitParamsSchema>) {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncSubmitTask';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as JimengT2iV31SubmitResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }

  async t2iV31GetResult(params: z.infer<typeof jimengT2iV31GetResultParamsSchema>) {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncGetResult';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as JimengT2iV31GetResultResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }

  /**
   * 即梦图生图3.0
   */
  async i2iV30Submit(params: z.infer<typeof jimengI2iV30SubmitParamsSchema>) {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncSubmitTask';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as JimengI2iV30SubmitResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }

  async i2iV30GetResult(params: z.infer<typeof jimengI2iV30GetResultParamsSchema>) {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncGetResult';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as JimengI2iV30GetResultResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }

  /**
   * 即梦视频生成S2.0 Pro
   */
  async t2vS20Pro(params: z.infer<typeof jimengt2vS20ProParamsSchema>) {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncSubmitTask';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as Jimengt2vS20ProResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }

  async t2vS20ProGetResult(params: z.infer<typeof jimengt2vS20ProGetResultParamsSchema>) {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncGetResult';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as Jimengt2vS20ProGetResultResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }

  /**
   * 即梦视频生成S2.0 Pro
   */
  async i2vS20Pro(params: z.infer<typeof jimengi2vS20ProParamsSchema>) {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncSubmitTask';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as Jimengi2vS20ProResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }

  async i2vS20ProGetResult(params: z.infer<typeof jimengi2vS20ProGetResultParamsSchema>) {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncGetResult';
    const version = '2022-08-31';
    const response = await this.signer.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as Jimengi2vS20ProGetResultResponse;
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data;
  }
}

export interface SignParams {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  region?: string;
  serviceName?: string;
  method?: string;
  pathName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  needSignHeaderKeys?: string[];
  bodySha?: string;
}

export interface RequestParams {
  host: string;
  method: 'GET' | 'POST';
  query: { Version: string; Action: string };
  headers?: Record<string, string>;
  body: string;
  serviceName: string;
  region: string;
}

export class Signer {
  private accessKeyId: string;
  private secretAccessKey: string;
  private serviceName: string;
  private region: string;

  /**
   * 不参与加签过程的 header key
   */
  private readonly HEADER_KEYS_TO_IGNORE = new Set(['authorization', 'content-type', 'content-length', 'user-agent', 'presigned-expires', 'expect']);

  constructor(accessKeyId: string, secretAccessKey: string, serviceName: string, region: string) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.serviceName = serviceName;
    this.region = region;
  }

  /**
   * 执行请求示例
   */
  async doRequest(params: RequestParams) {
    // 计算body的哈希值
    const bodySha = this.hash(params.body);

    const signParams: SignParams = {
      headers: {
        // x-date header 是必传的
        ['X-Date']: this.getDateTimeNow(),
        'Content-Type': 'application/json',
      },
      method: params.method,
      query: {
        Version: params.query.Version,
        Action: params.query.Action,
      },
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      serviceName: this.serviceName,
      region: this.region,
      bodySha: bodySha, // 将body哈希值传递给签名方法
    };

    // 正规化 query object， 防止串化后出现 query 值为 undefined 情况
    for (const [key, val] of Object.entries(signParams.query!)) {
      if (val === undefined || val === null) {
        signParams.query![key] = '';
      }
    }

    const authorization = this.sign(signParams);
    const res = await fetch(`${params.host}/?${qs.stringify(signParams.query!)}`, {
      headers: {
        ...signParams.headers,
        Authorization: authorization,
      },
      method: signParams.method,
      body: params.body,
    });
    return res;
  }

  /**
   * 生成签名
   */
  private sign(params: SignParams): string {
    const {
      headers = {},
      query = {},
      region = this.region,
      serviceName = this.serviceName,
      method = '',
      pathName = '/',
      accessKeyId = this.accessKeyId,
      secretAccessKey = this.secretAccessKey,
      needSignHeaderKeys = [],
      bodySha,
    } = params;

    const datetime = headers['X-Date']!;
    const date = datetime.substring(0, 8); // YYYYMMDD

    // 创建正规化请求
    const [signedHeaders, canonicalHeaders] = this.getSignHeaders(headers, needSignHeaderKeys);
    const canonicalRequest = [
      method.toUpperCase(),
      pathName,
      this.queryParamsToString(query) || '',
      `${canonicalHeaders}\n`,
      signedHeaders,
      bodySha || this.hash(''),
    ].join('\n');

    const credentialScope = [date, region, serviceName, 'request'].join('/');

    // 创建签名字符串
    const stringToSign = ['HMAC-SHA256', datetime, credentialScope, this.hash(canonicalRequest)].join('\n');

    // 计算签名
    const kDate = this.hmac(secretAccessKey, date);
    const kRegion = this.hmac(kDate, region);
    const kService = this.hmac(kRegion, serviceName);
    const kSigning = this.hmac(kService, 'request');
    const signature = this.hmac(kSigning, stringToSign).toString('hex');

    return ['HMAC-SHA256', `Credential=${accessKeyId}/${credentialScope},`, `SignedHeaders=${signedHeaders},`, `Signature=${signature}`].join(' ');
  }

  /**
   * 计算 HMAC
   */
  private hmac(secret: string | Buffer, s: string): Buffer {
    return crypto.createHmac('sha256', secret).update(s, 'utf8').digest();
  }

  /**
   * 计算哈希值
   */
  private hash(s: string): string {
    return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
  }

  /**
   * 将查询参数转换为字符串
   */
  private queryParamsToString(params: Record<string, any>): string {
    return Object.keys(params)
      .sort()
      .map(key => {
        const val = params[key];
        if (typeof val === 'undefined' || val === null) {
          return undefined;
        }
        const escapedKey = this.uriEscape(key);
        if (!escapedKey) {
          return undefined;
        }
        if (Array.isArray(val)) {
          return `${escapedKey}=${val.map(this.uriEscape.bind(this)).sort().join(`&${escapedKey}=`)}`;
        }
        return `${escapedKey}=${this.uriEscape(val)}`;
      })
      .filter(v => v)
      .join('&');
  }

  /**
   * 获取签名头信息
   */
  private getSignHeaders(originHeaders: Record<string, string>, needSignHeaders: string[]): [string, string] {
    const trimHeaderValue = (header: any): string => {
      return header.toString?.().trim().replace(/\s+/g, ' ') ?? '';
    };

    let h = Object.keys(originHeaders);

    // 根据 needSignHeaders 过滤
    if (Array.isArray(needSignHeaders)) {
      const needSignSet = new Set([...needSignHeaders, 'x-date', 'host'].map(k => k.toLowerCase()));
      h = h.filter(k => needSignSet.has(k.toLowerCase()));
    }

    // 根据 ignore headers 过滤
    h = h.filter(k => !this.HEADER_KEYS_TO_IGNORE.has(k.toLowerCase()));

    const signedHeaderKeys = h
      .slice()
      .map(k => k.toLowerCase())
      .sort()
      .join(';');

    const canonicalHeaders = h
      .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
      .map(k => `${k.toLowerCase()}:${trimHeaderValue(originHeaders[k])}`)
      .join('\n');

    return [signedHeaderKeys, canonicalHeaders];
  }

  /**
   * URI 转义
   */
  private uriEscape(str: string): string {
    try {
      return encodeURIComponent(str)
        .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
        .replace(/[*]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
    } catch (e) {
      return '';
    }
  }

  /**
   * 获取当前日期时间
   */
  private getDateTimeNow(): string {
    const now = new Date();
    return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  /**
   * 生成签名（公共方法，用于外部调用）
   */
  public generateSignature(params: SignParams): string {
    return this.sign(params);
  }

  /**
   * 获取当前配置信息
   */
  public getConfig() {
    return {
      accessKeyId: this.accessKeyId,
      serviceName: this.serviceName,
      region: this.region,
    };
  }
}
