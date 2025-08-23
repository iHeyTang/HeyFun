import { DaytonaSandboxManager } from './daytona';
import { LocalSandboxManager } from './local';

type SandboxManagerType = 'daytona' | 'local';

type SandboxManager = DaytonaSandboxManager | LocalSandboxManager;

function getSandboxManager(type: SandboxManagerType): SandboxManager {
  if (type === 'local') {
    return new LocalSandboxManager();
  }
  if (type === 'daytona') {
    return new DaytonaSandboxManager({
      apiKey: process.env.DAYTONA_API_KEY,
      organizationId: process.env.DAYTONA_ORGANIZATION_ID,
    });
  }
  throw new Error(`Unsupported sandbox manager type: ${type}`);
}

const SANDBOX_MANAGER_TYPE = (process.env.SANDBOX_MANAGER_TYPE || 'local') as SandboxManagerType;

const sandboxManager = getSandboxManager(SANDBOX_MANAGER_TYPE);

export default sandboxManager;

export type { SandboxRunner } from './base';
