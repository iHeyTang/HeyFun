import { ToolResult } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';

export async function getCurrentTimeExecutor(args: any, context: ToolContext): Promise<ToolResult> {
  try {
    const { timezone, format = 'iso' } = args;
    const now = new Date();

    let formattedTime: string;
    const timestamp = now.getTime();

    if (timezone) {
      // 使用指定时区
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        if (format === 'iso') {
          // ISO 8601 格式
          const parts = formatter.formatToParts(now);
          const year = parts.find(p => p.type === 'year')?.value;
          const month = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;
          const hour = parts.find(p => p.type === 'hour')?.value;
          const minute = parts.find(p => p.type === 'minute')?.value;
          const second = parts.find(p => p.type === 'second')?.value;
          formattedTime = `${year}-${month}-${day}T${hour}:${minute}:${second}${timezone === 'UTC' ? 'Z' : ''}`;
        } else if (format === 'locale') {
          formattedTime = formatter.format(now);
        } else {
          formattedTime = timestamp.toString();
        }
      } catch (error) {
        return {
          success: false,
          error: `Invalid timezone: ${timezone}`,
        };
      }
    } else {
      // 使用服务器本地时间
      if (format === 'iso') {
        formattedTime = now.toISOString();
      } else if (format === 'locale') {
        formattedTime = now.toLocaleString();
      } else {
        formattedTime = timestamp.toString();
      }
    }

    return {
      success: true,
      data: {
        time: formattedTime,
        timestamp,
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

