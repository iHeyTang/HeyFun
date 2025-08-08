import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

interface McpClientInfo {
  client: Client;
}

export default class McpHost {
  private mcps: Record<string, McpClientInfo> = {};

  constructor() {
    this.mcps = {};
  }

  async addStdioMcp(config: { id: string; command: string; args: string[]; env: Record<string, string> }) {
    const mcp = new Client({
      name: config.command,
      version: '1.0.0',
    });
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });
    await mcp.connect(transport);
    this.mcps[config.id] = {
      client: mcp,
    };
  }

  async addSseMcp(config: { id: string; url: string; headers: Record<string, string> }) {
    const mcp = new Client({
      name: config.url,
      version: '1.0.0',
    });
    const transport = new SSEClientTransport(new URL(config.url), {
      requestInit: {
        headers: config.headers,
      },
    });
    await mcp.connect(transport);
    this.mcps[config.id] = {
      client: mcp,
    };
  }

  getClient(id: string) {
    return this.mcps[id]?.client;
  }

  getClientInfo(id: string) {
    return this.mcps[id];
  }

  async cleanup() {
    const promises = Object.values(this.mcps).map(clientInfo => clientInfo.client.close());
    await Promise.all(promises);
  }
}
