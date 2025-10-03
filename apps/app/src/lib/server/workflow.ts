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
    const url = params.url.startsWith('http') ? params.url : `${process.env.NEXT_PUBLIC_APP_URL}${params.url}`;
    const res = await this.workflow.trigger({ url, body: params.body, delay: params.delay, flowControl: params.flowControl, retries: 0 });
    return {
      workflowRunId: res.workflowRunId,
    };
  }
}

export const workflow = new Workflow();
