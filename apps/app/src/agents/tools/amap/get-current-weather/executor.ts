import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { ToolContext } from '../../context';
import { callAmapApi, geocodeAddress, getAmapApiKey } from '../utils';
import { getCurrentWeatherParamsSchema } from './schema';

/**
 * 高德地图天气API
 * 文档: https://lbs.amap.com/api/webservice/guide/api/weatherinfo
 */
async function getWeatherFromAmap(city: string) {
  const apiKey = getAmapApiKey();

  // 先通过地理编码获取城市adcode
  const geocodeResult = await geocodeAddress(city);
  const adcode = geocodeResult.adcode;
  const cityName = geocodeResult.formatted_address || city;

  if (!adcode) {
    throw new Error(`未找到城市 "${city}" 的adcode信息`);
  }

  // 获取天气信息
  const weatherUrl = `https://restapi.amap.com/v3/weather/weatherInfo?key=${apiKey}&city=${adcode}&extensions=all`;
  const weatherData = await callAmapApi(weatherUrl, '获取天气信息');

  if (!weatherData.forecasts || weatherData.forecasts.length === 0) {
    throw new Error('未找到天气信息');
  }

  const forecast = weatherData.forecasts[0];
  const casts = forecast.casts || [];
  const today = casts[0] || {};

  // 获取实时天气（如果有）
  const lives = weatherData.lives || [];
  const live = lives[0] || {};

  // 优先使用实时天气，如果没有则使用预报
  const temperature = live.temperature ? parseInt(live.temperature) : today.daytemp ? parseInt(today.daytemp) : null;
  const condition = live.weather || today.dayweather || '未知';
  const humidity = live.humidity ? parseInt(live.humidity) : null;
  const windDirection = live.winddirection || today.daywind || '';
  const windPower = live.windpower || today.daypower || '';

  return {
    city: cityName,
    temperature,
    condition,
    humidity,
    windDirection,
    windPower,
    province: forecast.province || '',
    reportTime: live.reporttime || forecast.reporttime || '',
    adcode,
  };
}

export const getCurrentWeatherExecutor = definitionToolExecutor(getCurrentWeatherParamsSchema, async args => {
  try {
    const { city, unit = 'celsius' } = args;

    const weatherData = await getWeatherFromAmap(city);

    // 温度单位转换
    let temperature = weatherData.temperature;
    if (unit === 'fahrenheit' && temperature !== null) {
      temperature = Math.round((temperature * 9) / 5 + 32);
    }

    // 构建描述
    const tempStr = temperature !== null ? `${temperature}${unit === 'celsius' ? '°C' : '°F'}` : '未知';
    const humidityStr = weatherData.humidity !== null ? `${weatherData.humidity}%` : '未知';
    const windStr = weatherData.windPower ? `${weatherData.windDirection} ${weatherData.windPower}级` : '未知';

    const description = `${weatherData.city} 当前天气${weatherData.condition}，温度 ${tempStr}，湿度 ${humidityStr}，${windStr}`;

    return {
      success: true,
      data: {
        city: weatherData.city,
        temperature,
        unit,
        condition: weatherData.condition,
        humidity: weatherData.humidity,
        windSpeed: null, // 高德地图API不直接提供风速，只有风力等级
        windDirection: weatherData.windDirection,
        windPower: weatherData.windPower,
        province: weatherData.province,
        reportTime: weatherData.reportTime,
        description,
      },
      message: `已获取 ${weatherData.city} 的天气信息`,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
});
