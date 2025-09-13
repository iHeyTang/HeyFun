import crypto from 'crypto';
import qs from 'querystring';
import { z } from 'zod';

export const volcengineJimengServiceConfigSchema = z.object({
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
});

export class VolcengineJimengProvider {
  public readonly homePage = 'https://jimeng.jianying.com/';
  readonly signer: Signer;

  constructor(config: z.infer<typeof volcengineJimengServiceConfigSchema>) {
    this.signer = new Signer(config.accessKeyId, config.secretAccessKey, 'cv', 'cn-north-1');
  }

  async doRequest(params: RequestParams) {
    return this.signer.doRequest(params);
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
