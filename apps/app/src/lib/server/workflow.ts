import { Client } from '@upstash/workflow';
import { resolveUrl, getAppBaseUrl } from '../shared/url';

type Unit = 's' | 'm' | 'h' | 'd';
type Duration = `${bigint}${Unit}`;

class Workflow {
  private workflow: Client;
  constructor() {
    this.workflow = new Client({
      token: process.env.QSTASH_TOKEN,
    });
  }

  async trigger<T>(params: {
    url: string;
    body: T;
    delay?: Duration;
    flowControl?: { key: string; parallelism: number };
  }): Promise<{ workflowRunId: string }> {
    // 使用通用的 URL 解析函数
    const url = resolveUrl(params.url);

    // 如果是开发环境且使用的是 localhost，给出警告
    if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.VERCEL_URL) {
      console.warn(
        '[Workflow] NEXT_PUBLIC_APP_URL is not set. Using localhost, which may not be accessible by QStash. Please set NEXT_PUBLIC_APP_URL environment variable or use a tunneling service like ngrok for development.',
      );
    }

    try {
      const res = await this.workflow.trigger({ url, body: params.body, delay: params.delay, flowControl: params.flowControl, retries: 0 });
      return {
        workflowRunId: res.workflowRunId,
      };
    } catch (error) {
      console.error('[Workflow] Failed to trigger workflow:', error);
      // 如果是连接错误且是开发环境，提供更友好的错误信息
      if (error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED') {
        throw new Error(
          `Workflow trigger failed: QStash cannot access ${url}. In development, please set NEXT_PUBLIC_APP_URL to a publicly accessible URL (e.g., using ngrok: https://your-app.ngrok.io)`,
        );
      }
      throw error;
    }
  }

  async notify(eventId: string, eventData?: unknown): Promise<void> {
    await this.workflow.notify({ eventId, eventData });
  }
}

export const workflow = new Workflow();
