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
      apiKey: 'dtn_3333e91bf2eaa4d0948114b6760c62542318b5b7a9544fffd7f95e621e54f591',
      organizationId: '7aca54ca-f8ec-497d-b46b-7a1c7363ec15',
    });
  }
  throw new Error(`Unsupported sandbox manager type: ${type}`);
}

const SANDBOX_MANAGER_TYPE = (process.env.SANDBOX_MANAGER_TYPE || 'local') as SandboxManagerType;

const sandboxManager = getSandboxManager(SANDBOX_MANAGER_TYPE);

export default sandboxManager;

export type { SandboxRunner } from './base';
