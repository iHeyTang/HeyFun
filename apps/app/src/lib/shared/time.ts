export const formatTimeFromNow = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;

  // 超过 7 天，显示具体日期
  const date = new Date(timestamp);
  const today = new Date();
  const isThisYear = date.getFullYear() === today.getFullYear();

  if (isThisYear) {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * 获取当前时间的本地化字符串
 */
export const formatTime = (date: Date = new Date()): string => {
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};
