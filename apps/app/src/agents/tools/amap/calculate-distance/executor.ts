import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { calculateDistanceParamsSchema } from './schema';
import { ToolContext } from '../../context';
import { getAmapApiKey, callAmapApi, formatCoordinate } from '../utils';

/**
 * 高德地图距离计算API
 * 文档: https://lbs.amap.com/api/webservice/guide/api/distance
 */
async function calculateDistanceFromAmap(
  origin: { longitude: number; latitude: number },
  destination: { longitude: number; latitude: number },
  type: string,
  context: ToolContext,
) {
  const apiKey = getAmapApiKey();
  const originStr = formatCoordinate(origin);
  const destinationStr = formatCoordinate(destination);

  if (type === '1') {
    // 直线距离
    const url = `https://restapi.amap.com/v3/distance?key=${apiKey}&origins=${originStr}&destination=${destinationStr}&type=1`;
    const data = await callAmapApi(url, '距离计算');

    if (!data.results || data.results.length === 0) {
      throw new Error('未找到距离计算结果');
    }

    const result = data.results[0];
    return {
      distance: parseInt(result.distance || '0'),
      duration: null,
      type: '直线距离',
    };
  } else {
    // 驾车距离（需要路径规划）
    const url = `https://restapi.amap.com/v3/direction/driving?key=${apiKey}&origin=${originStr}&destination=${destinationStr}&strategy=0`;
    const data = await callAmapApi(url, '路径规划');

    if (!data.route || !data.route.paths || data.route.paths.length === 0) {
      throw new Error('未找到可行路径');
    }

    const path = data.route.paths[0];
    return {
      distance: parseInt(path.distance || '0'),
      duration: parseInt(path.duration || '0'),
      type: '驾车距离',
    };
  }
}

export const calculateDistanceExecutor = definitionToolExecutor(calculateDistanceParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    try {
      const { origin, destination, type = '1' } = args;

      const result = await calculateDistanceFromAmap(origin, destination, type, context);

      const distanceKm = (result.distance / 1000).toFixed(2);
      const durationMin = result.duration ? Math.round(result.duration / 60) : null;
      const message = result.duration ? `${result.type}：${distanceKm} 公里，预计 ${durationMin} 分钟` : `${result.type}：${distanceKm} 公里`;

      return {
        success: true,
        data: result,
        message,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
});
