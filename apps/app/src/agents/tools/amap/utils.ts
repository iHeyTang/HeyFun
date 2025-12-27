/**
 * 高德地图工具公共函数
 */

/**
 * 获取并验证高德地图 API Key
 */
export function getAmapApiKey(): string {
  const apiKey = process.env.AMAP_API_KEY;
  if (!apiKey) {
    throw new Error('高德地图API密钥未配置，请设置环境变量 AMAP_API_KEY');
  }
  return apiKey;
}

/**
 * 高德地图 API 响应类型
 */
export interface AmapApiResponse {
  status: string;
  info: string;
  [key: string]: any;
}

/**
 * 统一的 API 调用函数
 * @param url API 请求 URL
 * @param errorMessage 错误消息前缀
 * @returns API 响应数据
 */
export async function callAmapApi(url: string, errorMessage: string = 'API请求'): Promise<AmapApiResponse> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${errorMessage}失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== '1') {
    throw new Error(`${errorMessage}失败: ${data.info || '未知错误'}`);
  }

  return data;
}

/**
 * 坐标对象类型
 */
export interface Coordinate {
  longitude: number;
  latitude: number;
}

/**
 * 将坐标对象转换为字符串格式 "longitude,latitude"
 */
export function formatCoordinate(coordinate: Coordinate): string {
  return `${coordinate.longitude},${coordinate.latitude}`;
}

/**
 * 将坐标字符串 "longitude,latitude" 解析为坐标对象
 */
export function parseCoordinateString(locationStr: string): Coordinate {
  const parts = locationStr.split(',');
  if (parts.length !== 2) {
    throw new Error(`无效的坐标字符串格式: ${locationStr}`);
  }
  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  if (isNaN(longitude) || isNaN(latitude)) {
    throw new Error(`无效的坐标值: ${locationStr}`);
  }
  return { longitude, latitude };
}

/**
 * 地理编码结果
 */
export interface GeocodeResult {
  location: string;
  formatted_address: string;
  province?: string;
  city?: string;
  district?: string;
  adcode?: string;
  level?: string;
}

/**
 * 将地址转换为坐标（地理编码）
 * @param address 地址字符串
 * @param city 城市名称（可选）
 * @returns 地理编码结果
 */
export async function geocodeAddress(address: string, city?: string): Promise<GeocodeResult> {
  const apiKey = getAmapApiKey();

  let url = `https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(address)}`;
  if (city) {
    url += `&city=${encodeURIComponent(city)}`;
  }

  const data = await callAmapApi(url, '地理编码');

  if (!data.geocodes || data.geocodes.length === 0) {
    throw new Error(`未找到地址 "${address}" 的地理编码信息`);
  }

  return data.geocodes[0];
}

/**
 * 将地址或坐标转换为坐标字符串
 * @param location 地址字符串或坐标对象
 * @returns 坐标字符串 "longitude,latitude"
 */
export async function formatLocation(location: string | Coordinate): Promise<string> {
  if (typeof location === 'string') {
    // 如果是地址字符串，先进行地理编码
    const geocodeResult = await geocodeAddress(location);
    return geocodeResult.location;
  } else {
    // 如果是坐标对象，直接格式化
    return formatCoordinate(location);
  }
}

