import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { geocodeParamsSchema } from './schema';
import { ToolContext } from '../../context';
import { geocodeAddress, parseCoordinateString } from '../utils';

/**
 * 高德地图地理编码API
 * 文档: https://lbs.amap.com/api/webservice/guide/api/georegeo
 */
async function geocodeFromAmap(address: string, city: string | undefined, context: ToolContext) {
  const geocode = await geocodeAddress(address, city);
  const location = parseCoordinateString(geocode.location);

  return {
    address,
    formattedAddress: geocode.formatted_address,
    location,
    province: geocode.province || '',
    city: geocode.city || '',
    district: geocode.district || '',
    adcode: geocode.adcode || '',
    level: geocode.level || '',
  };
}

export const geocodeExecutor = definitionToolExecutor(geocodeParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    try {
      const { address, city } = args;

      const result = await geocodeFromAmap(address, city, context);

      return {
        success: true,
        data: result,
        message: `已获取地址 "${address}" 的地理坐标`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
});
