import { Client } from '@upstash/qstash';

type Unit = 's' | 'm' | 'h' | 'd';
type Duration = `${bigint}${Unit}`;

class Queue {
  private qstash: Client;
  constructor() {
    this.qstash = new Client({
      token: process.env.QSTASH_TOKEN,
    });
  }

  async publish<T>(params: { url: string; body: T; delay?: Duration; flowControl?: { key: string; parallelism: number } }) {
    const url = params.url.startsWith('http') ? params.url : `${process.env.NEXT_PUBLIC_APP_URL}${params.url}`;
    const res = await this.qstash.publishJSON({ url, body: params.body, delay: params.delay, flowControl: params.flowControl });
    return {
      deduplicated: res.deduplicated,
      messageId: res.messageId,
      url: res.url,
    };
  }
}

export const queue = new Queue();
