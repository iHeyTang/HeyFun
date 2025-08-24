import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { AddSseMcpConfig, AddStdioMcpConfig } from './types';

interface McpClientInfo {
  client: Client;
}

export default class McpHost {
  private mcps: Record<string, McpClientInfo> = {};

  constructor() {
    this.mcps = {};
  }

  async addStdioMcp(config: AddStdioMcpConfig) {
    const mcp = new Client({
      name: config.name,
      version: config.version,
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

  async addSseMcp(config: AddSseMcpConfig) {
    const mcp = new Client({
      name: config.name,
      version: config.version,
    });
    const transport = new SSEClientTransport(new URL(config.url), {
      requestInit: {
        headers: { 'Content-Type': 'text/event-stream', ...config.headers },
      },
    });
    try {
      await mcp.connect(transport, {
        onprogress: progress => {
          console.log('mcp progress', config.id, progress);
        },
      });
      this.mcps[config.id] = {
        client: mcp,
      };
    } catch (error) {
      console.error('mcp connect error', config.id, error);
    }
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
