import { CreateSandboxFromSnapshotParams, Daytona, DaytonaConfig, Sandbox } from '@daytonaio/sdk';
import { BaseSandboxManager, SandboxRunner } from './base';

export class DaytonaSandboxRunner extends SandboxRunner {
  constructor(
    public readonly id: string,
    private sandbox: Sandbox,
  ) {
    super();
  }

  getRunnerDomain(): string {
    if (!this.sandbox.runnerDomain) {
      throw new Error('Sandbox runner domain is not set');
    }
    return this.sandbox.runnerDomain;
  }
}

export class DaytonaSandboxManager extends BaseSandboxManager {
  private daytona: Daytona;

  constructor(config?: DaytonaConfig) {
    super();
    this.daytona = new Daytona(config);
  }

  async list(): Promise<SandboxRunner[]> {
    const sandboxes = await this.daytona.list();
    return sandboxes.map(sandbox => {
      const id = `daytona-${sandbox.id}`;
      return new DaytonaSandboxRunner(id, sandbox);
    });
  }

  async findOneById(id: string): Promise<SandboxRunner> {
    const innerId = id.replace('daytona-', '');
    const sandbox = await this.daytona.findOne({ id: innerId });
    return new DaytonaSandboxRunner(id, sandbox);
  }

  async create(): Promise<SandboxRunner> {
    const sandbox = await this.daytona.create({});
    const id = `daytona-${sandbox.id}`;
    const runner = new DaytonaSandboxRunner(id, sandbox);
    return runner;
  }

  async delete(id: string, timeout?: number): Promise<void> {
    const innerId = id.replace('daytona-', '');
    const sandbox = await this.daytona.findOne({ id: innerId });
    await this.daytona.delete(sandbox, timeout);
  }

  async start(id: string): Promise<void> {
    const innerId = id.replace('daytona-', '');
    const sandbox = await this.daytona.findOne({ id: innerId });
    await this.daytona.start(sandbox);
  }

  async stop(id: string): Promise<void> {
    const innerId = id.replace('daytona-', '');
    const sandbox = await this.daytona.findOne({ id: innerId });
    await this.daytona.stop(sandbox);
  }
}
