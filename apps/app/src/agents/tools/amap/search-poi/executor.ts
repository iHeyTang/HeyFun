import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { searchPoiParamsSchema } from './schema';
import { ToolContext } from '../../context';
import { getAmapApiKey, callAmapApi, formatCoordinate, parseCoordinateString } from '../utils';

/**
 * 高德地图POI搜索API
 * 文档: https://lbs.amap.com/api/webservice/guide/api/search
 */
async function searchPoiFromAmap(
  keyword: string,
  city: string | undefined,
  location: { longitude: number; latitude: number } | undefined,
  radius: number | undefined,
  types: string | undefined,
  page: number,
  pageSize: number,
  context: ToolContext,
) {
  const apiKey = getAmapApiKey();

  let url = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(keyword)}`;

  if (city) {
    url += `&city=${encodeURIComponent(city)}`;
  }

  if (location) {
    url += `&location=${formatCoordinate(location)}`;
  }

  if (radius) {
    url += `&radius=${radius}`;
  }

  if (types) {
    url += `&types=${encodeURIComponent(types)}`;
  }

  url += `&page=${page}&offset=${pageSize}`;

  const data = await callAmapApi(url, 'POI搜索');

  const pois = (data.pois || []).map((poi: any) => {
    const location = poi.location ? parseCoordinateString(poi.location) : null;

    return {
      name: poi.name || '',
      type: poi.type || '',
      address: poi.address || '',
      location,
      distance: poi.distance ? parseInt(poi.distance) : null,
      tel: poi.tel || '',
      province: poi.pname || '',
      city: poi.cityname || '',
      district: poi.adname || '',
    };
  });

  return {
    pois,
    count: parseInt(data.count || '0'),
    page,
    pageSize,
  };
}

export const searchPoiExecutor = definitionToolExecutor(searchPoiParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    try {
      const { keyword, city, location, radius, types, page = 1, pageSize = 10 } = args;

      const result = await searchPoiFromAmap(keyword, city, location, radius, types, page, pageSize, context);

      return {
        success: true,
        data: result,
        message: `找到 ${result.count} 个相关POI，当前显示第 ${page} 页，共 ${result.pois.length} 条结果`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
});
