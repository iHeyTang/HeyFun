import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { callAmapApi, formatLocation, getAmapApiKey } from '../utils';
import { routePlanningParamsSchema } from './schema';

/**
 * 高德地图路径规划API
 * 文档: https://lbs.amap.com/api/webservice/guide/api/direction
 */
async function planRouteFromAmap(
  origin: string | { longitude: number; latitude: number },
  destination: string | { longitude: number; latitude: number },
  strategy: string,
  waypoints: Array<string | { longitude: number; latitude: number }> | undefined,
) {
  const apiKey = getAmapApiKey();

  // 转换起点和终点
  const originStr = await formatLocation(origin);
  const destinationStr = await formatLocation(destination);

  let url = `https://restapi.amap.com/v3/direction/driving?key=${apiKey}&origin=${originStr}&destination=${destinationStr}&strategy=${strategy}`;

  // 处理途经点
  if (waypoints && waypoints.length > 0) {
    const waypointStrs = await Promise.all(waypoints.map(wp => formatLocation(wp)));
    url += `&waypoints=${waypointStrs.join('|')}`;
  }

  const data = await callAmapApi(url, '路径规划');

  if (!data.route || !data.route.paths || data.route.paths.length === 0) {
    throw new Error('未找到可行路径');
  }

  const routes = data.route.paths.map((path: any) => {
    const steps = (path.steps || []).map((step: any) => ({
      instruction: step.instruction || '',
      road: step.road || '',
      distance: parseInt(step.distance || '0'),
      duration: parseInt(step.duration || '0'),
    }));

    return {
      distance: parseInt(path.distance || '0'),
      duration: parseInt(path.duration || '0'),
      tolls: parseFloat(path.tolls || '0'),
      tollDistance: parseInt(path.toll_distance || '0'),
      steps,
    };
  });

  return {
    routes,
  };
}

export const routePlanningExecutor = definitionToolExecutor(routePlanningParamsSchema, async args => {
  try {
    const { origin, destination, strategy = '0', waypoints } = args;

    const result = await planRouteFromAmap(origin, destination, strategy, waypoints);

    const bestRoute = result.routes[0];
    const distanceKm = (bestRoute.distance / 1000).toFixed(2);
    const durationMin = Math.round(bestRoute.duration / 60);

    return {
      success: true,
      data: result,
      message: `已规划路径，共 ${result.routes.length} 条方案。推荐方案：距离 ${distanceKm} 公里，预计 ${durationMin} 分钟，过路费 ${bestRoute.tolls} 元`,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
});
