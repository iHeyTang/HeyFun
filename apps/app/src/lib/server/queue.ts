import { Client } from '@upstash/qstash';
import { resolveUrl } from '../shared/url';

type Unit = 's' | 'm' | 'h' | 'd';
type Duration = `${bigint}${Unit}`;

/**
 * Queue Routes Interface
 * 在各自的 route 文件中通过 module augmentation 来扩展此接口
 *
 * 使用方式：
 * declare module '@/lib/server/queue' {
 *   interface QueueRoutes {
 *     '/api/queue/your-route': {
 *       // 定义 body 类型
 *     }
 *   }
 * }
 */
export interface QueueRoutes {
  // 类型定义在各自的 route 文件中通过 module augmentation 来扩展
}

type QueueRoute = keyof QueueRoutes;
type QueueRouteBody<T extends QueueRoute> = QueueRoutes[T];

class Queue {
  private qstash: Client;
  constructor() {
    this.qstash = new Client({
      token: process.env.QSTASH_TOKEN,
    });
  }

  async publish<T extends QueueRoute>(params: {
    url: T;
    body: QueueRouteBody<T>;
    delay?: Duration;
    flowControl?: { key: string; parallelism: number };
  }) {
    // 使用通用的 URL 解析函数
    const url = resolveUrl(String(params.url));
    const res = await this.qstash.publishJSON({ url, body: params.body, delay: params.delay, flowControl: params.flowControl });
    return {
      deduplicated: 'deduplicated' in res ? res.deduplicated : undefined,
      messageId: 'messageId' in res ? res.messageId : undefined,
      url: 'url' in res ? res.url : undefined,
    };
  }
}

export const queue = new Queue();
