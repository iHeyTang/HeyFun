import z from 'zod';

export const a302aiServiceConfigSchema = z.object({
  apiKey: z.string().min(1),
});

export type A302aiRequestParams<T> = {
  path: string;
  method: 'GET' | 'POST';
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: T;
};

const BASE_URL = 'https://api.302.ai';

export class A302aiProvider {
  private readonly apiKey: string;

  constructor(config: z.infer<typeof a302aiServiceConfigSchema>) {
    this.apiKey = config.apiKey;
  }

  async request<R = unknown, T = unknown>(params: A302aiRequestParams<T>): Promise<R> {
    const url = new URL(`${BASE_URL}${params.path}`);
    const query = new URLSearchParams(params.query);
    url.search = query.toString();
    console.log(params.body);
    try {
      const response = await fetch(url, {
        method: params.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...params.headers,
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
      });
      return response.json() as Promise<R>;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
