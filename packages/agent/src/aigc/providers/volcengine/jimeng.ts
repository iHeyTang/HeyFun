import {
  jimengI2iV30GetResultParamsSchema,
  JimengI2iV30GetResultResponse,
  jimengI2iV30SubmitParamsSchema,
  JimengI2iV30SubmitResponse,
  jimengi2vS20ProGetResultParamsSchema,
  Jimengi2vS20ProGetResultResponse,
  jimengi2vS20ProParamsSchema,
  Jimengi2vS20ProResponse,
  jimengT2iV21ParamsSchema,
  JimengT2iV21Response,
  jimengT2iV30GetResultParamsSchema,
  JimengT2iV30GetResultResponse,
  jimengT2iV30SubmitParamsSchema,
  JimengT2iV30SubmitResponse,
  jimengT2iV31GetResultParamsSchema,
  JimengT2iV31GetResultResponse,
  jimengT2iV31SubmitParamsSchema,
  JimengT2iV31SubmitResponse,
  jimengt2vS20ProGetResultParamsSchema,
  Jimengt2vS20ProGetResultResponse,
  jimengt2vS20ProParamsSchema,
  Jimengt2vS20ProResponse,
} from '@/aigc/services/jimeng';
import crypto from 'crypto';
import fetch from 'node-fetch';
import qs from 'querystring';
import { z } from 'zod';

const VOLCENGINE_JIMENG_ACCESS_KEY_ID = process.env.VOLCENGINE_JIMENG_ACCESS_KEY_ID;
const VOLCENGINE_JIMENG_SECRET_ACCESS_KEY = process.env.VOLCENGINE_JIMENG_SECRET_ACCESS_KEY;

export class VolcengineJimeng {
  public readonly homePage = 'https://jimeng.jianying.com/';
  private readonly signer: Signer;

  constructor() {
    this.signer = new Signer(VOLCENGINE_JIMENG_ACCESS_KEY_ID!, VOLCENGINE_JIMENG_SECRET_ACCESS_KEY!, 'cv', 'cn-north-1');
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
