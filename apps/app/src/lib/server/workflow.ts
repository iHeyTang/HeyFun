import { Client } from '@upstash/workflow';

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
    let url = params.url;
    if (!url.startsWith('http')) {
      // 构建完整URL
      let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!baseUrl) {
        // 如果没有设置NEXT_PUBLIC_APP_URL，尝试使用VERCEL_URL
        if (process.env.VERCEL_URL) {
          baseUrl = `https://${process.env.VERCEL_URL}`;
        } else {
          // 开发环境：需要设置NEXT_PUBLIC_APP_URL环境变量
          // 如果使用本地开发，可以配置ngrok等工具提供公网可访问的URL
          // 例如：NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io
          baseUrl = 'http://localhost:3000';
          console.warn(
            '[Workflow] NEXT_PUBLIC_APP_URL is not set. Using localhost, which may not be accessible by QStash. Please set NEXT_PUBLIC_APP_URL environment variable or use a tunneling service like ngrok for development.',
          );
        }
      }
      url = `${baseUrl}${params.url}`;
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
