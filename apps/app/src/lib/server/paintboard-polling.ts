import { pollPaintboardTaskResults } from '@/actions/paintboard';

// 轮询间隔（毫秒）
const POLLING_INTERVAL = 10000; // 10秒

let pollingInterval: NodeJS.Timeout | null = null;

// 启动轮询
export function startPaintboardPolling() {
  if (pollingInterval) {
    console.log('Paintboard polling is already running');
    return;
  }

  console.log('Starting paintboard task polling...');

  pollingInterval = setInterval(async () => {
    try {
      await pollPaintboardTaskResults({});
    } catch (error) {
      console.error('Error in paintboard polling:', error);
    }
  }, POLLING_INTERVAL);

  console.log(`Paintboard polling started with ${POLLING_INTERVAL}ms interval`);
}

// 停止轮询
export function stopPaintboardPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Paintboard polling stopped');
  }
}

// 检查轮询状态
export function isPaintboardPollingRunning(): boolean {
  return pollingInterval !== null;
}

// 在应用启动时自动启动轮询
if (typeof window === 'undefined') {
  // 只在服务器端启动
  startPaintboardPolling();
}
