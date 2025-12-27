import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { reverseGeocodeParamsSchema } from './schema';
import { ToolContext } from '../../context';
import { getAmapApiKey, callAmapApi, formatCoordinate } from '../utils';

/**
 * 高德地图逆地理编码API
 * 文档: https://lbs.amap.com/api/webservice/guide/api/georegeo
 */
async function reverseGeocodeFromAmap(longitude: number, latitude: number, radius: number | undefined, context: ToolContext) {
  const apiKey = getAmapApiKey();
  let url = `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${formatCoordinate({ longitude, latitude })}`;
  if (radius) {
    url += `&radius=${radius}`;
  }

  const data = await callAmapApi(url, '逆地理编码');

  if (!data.regeocode) {
    throw new Error('未找到坐标对应的地址信息');
  }

  const regeocode = data.regeocode;
  const addressComponent = regeocode.addressComponent || {};

  return {
    formattedAddress: regeocode.formatted_address || '',
    province: addressComponent.province || '',
    city: addressComponent.city || '',
    district: addressComponent.district || '',
    street: addressComponent.street || '',
    streetNumber: addressComponent.streetNumber || '',
    adcode: addressComponent.adcode || '',
    location: {
      longitude,
      latitude,
    },
  };
}

export const reverseGeocodeExecutor = definitionToolExecutor(reverseGeocodeParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    try {
      const { longitude, latitude, radius } = args;

      const result = await reverseGeocodeFromAmap(longitude, latitude, radius, context);

      return {
        success: true,
        data: result,
        message: `已获取坐标 (${longitude}, ${latitude}) 的地址信息`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
});
