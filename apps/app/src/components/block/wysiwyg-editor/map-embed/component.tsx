'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';

interface RoutePoint {
  location: string; // 经纬度 "lng,lat"
  name?: string; // 地点名称
}

interface RouteData {
  path: Array<[number, number]>; // 路径点数组 [[lng, lat], ...]
  distance?: number; // 距离（米）
  duration?: number; // 时长（秒）
}

interface MapEmbedProps {
  location?: string; // 经纬度 "116.397428,39.90923"
  name?: string; // 地点名称
  zoom?: number; // 缩放级别 (3-18)
  width?: number; // 地图宽度
  height?: number; // 地图高度
  // 路径规划相关
  'data-from-location'?: string; // 起点经纬度
  'data-from-name'?: string; // 起点名称
  'data-to-location'?: string; // 终点经纬度
  'data-to-name'?: string; // 终点名称
  'data-route-type'?: 'car' | 'walk' | 'bus' | 'bike'; // 路线类型
  'data-policy'?: string; // 路线策略（字符串形式）
  'data-route-data'?: string; // 路径数据（JSON 字符串）
}

// 高德地图 API Key 和 安全密钥
// 安全密钥虽然会暴露到前端，但需要在高德控制台配置域名白名单才能真正起作用
// 建议从环境变量读取，不要硬编码
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_API_KEY!;
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || '';

// 声明全局类型
declare global {
  interface Window {
    AMap?: any;
  }
}

// 使用 npm 包加载高德地图 API
let amapPromise: Promise<any> | null = null;

async function loadAmapAPI(): Promise<any> {
  // 检查是否在浏览器环境中
  if (typeof window === 'undefined') {
    throw new Error('高德地图只能在浏览器环境中使用');
  }

  // 如果已经加载，直接返回
  if (window.AMap) {
    return window.AMap;
  }

  // 如果正在加载，返回同一个 Promise
  if (amapPromise) {
    return amapPromise;
  }

  // 动态导入 AMapLoader（避免在 SSR 时执行）
  const AMapLoader = (await import('@amap/amap-jsapi-loader')).default;

  // 设置安全密钥（在使用 loader 之前设置）
  // 注意：安全密钥会暴露到前端，建议在高德控制台配置域名白名单
  if (AMAP_SECURITY_CODE) {
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_CODE,
    };
  }

  // 使用官方 loader 加载 API
  amapPromise = AMapLoader.load({
    key: AMAP_KEY,
    version: '2.0',
    plugins: ['AMap.Driving', 'AMap.Walking', 'AMap.Riding', 'AMap.Transfer'], // 预加载常用插件
  })
    .then(AMap => {
      window.AMap = AMap;
      return AMap;
    })
    .catch(error => {
      amapPromise = null; // 加载失败，重置 Promise
      throw error;
    });

  return amapPromise;
}

/**
 * 地图嵌入组件
 * 使用 React 直接渲染高德地图
 * 支持单点标记和路径规划两种模式
 */
export function MapEmbed({
  location,
  name,
  zoom = 14,
  width = 600,
  height = 400,
  'data-from-location': fromLocation,
  'data-from-name': fromName,
  'data-to-location': toLocation,
  'data-to-name': toName,
  'data-route-type': routeType = 'car',
  'data-policy': policyStr = '1',
  'data-route-data': routeDataStr,
}: MapEmbedProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; time: number } | null>(null);

  // 判断是否为路径规划模式
  const isRouteMode = fromLocation && toLocation;

  // 解析路径数据
  const routeData: RouteData | undefined = routeDataStr
    ? (() => {
        try {
          return JSON.parse(routeDataStr);
        } catch (error) {
          console.error('解析路径数据失败:', error);
          return undefined;
        }
      })()
    : undefined;

  // 构建路径规划数据
  const from: RoutePoint | undefined = fromLocation
    ? {
        location: fromLocation,
        name: fromName || '',
      }
    : undefined;

  const to: RoutePoint | undefined = toLocation
    ? {
        location: toLocation,
        name: toName || '',
      }
    : undefined;

  const policy = parseInt(policyStr, 10) || 1;

  // 分割经纬度
  const [lng, lat] = location ? location.split(',').map(v => v.trim()) : ['0', '0'];

  // 验证坐标格式
  const isValidCoord = lng && lat && !isNaN(parseFloat(lng)) && !isNaN(parseFloat(lat));

  // 构建高德地图官方链接（用于外部打开）
  const amapUrl =
    isRouteMode && from && to
      ? `https://ditu.amap.com/dir?from[lnglat]=${from.location}&from[name]=${encodeURIComponent(from.name || '起点')}&to[lnglat]=${to.location}&to[name]=${encodeURIComponent(to.name || '终点')}&type=${routeType}&policy=${policy}`
      : location
        ? `https://uri.amap.com/marker?position=${location}&name=${encodeURIComponent(name || '地点')}&src=okey&coordinate=gaode`
        : 'https://ditu.amap.com';

  // 初始化地图
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setMapError(null);

        // 使用 npm 包加载高德地图 API
        const AMap = await loadAmapAPI();

        if (!isMounted || !mapContainerRef.current) return;

        if (isRouteMode && from && to) {
          // 路径规划模式
          const fromCoords = from.location.split(',').map(v => parseFloat(v.trim()));
          const toCoords = to.location.split(',').map(v => parseFloat(v.trim()));

          if (fromCoords.length < 2 || toCoords.length < 2 || fromCoords.some(isNaN) || toCoords.some(isNaN)) {
            throw new Error('起点或终点坐标格式无效');
          }

          const fromLng: number = fromCoords[0]!;
          const fromLat: number = fromCoords[1]!;
          const toLng: number = toCoords[0]!;
          const toLat: number = toCoords[1]!;

          // 计算中心点
          const centerLng = (fromLng + toLng) / 2;
          const centerLat = (fromLat + toLat) / 2;

          // 创建地图实例
          const map = new AMap.Map(mapContainerRef.current, {
            zoom: 12,
            center: [centerLng, centerLat],
            viewMode: '2D',
            resizeEnable: true,
          });

          mapInstanceRef.current = map;

          // 添加起点和终点标记
          const startMarker = new AMap.Marker({
            position: [fromLng, fromLat],
            icon: new AMap.Icon({
              size: new AMap.Size(25, 34),
              image: '//a.amap.com/jsapi_demos/static/demo-center/icons/dir-marker.png',
              imageSize: new AMap.Size(135, 40),
              imageOffset: new AMap.Pixel(-9, -3),
            }),
            offset: new AMap.Pixel(-13, -30),
          });

          const endMarker = new AMap.Marker({
            position: [toLng, toLat],
            icon: new AMap.Icon({
              size: new AMap.Size(25, 34),
              image: '//a.amap.com/jsapi_demos/static/demo-center/icons/dir-marker.png',
              imageSize: new AMap.Size(135, 40),
              imageOffset: new AMap.Pixel(-95, -3),
            }),
            offset: new AMap.Pixel(-13, -30),
          });

          map.add([startMarker, endMarker]);

          // 判断是否有 MCP 返回的路径数据
          const hasRouteData = routeData && routeData.path && routeData.path.length > 0;

          if (hasRouteData && routeData) {
            // 使用 MCP 返回的路径数据直接绘制
            const path = routeData.path;
            const distance = routeData.distance ? routeData.distance / 1000 : 0;
            const time = routeData.duration ? Math.ceil(routeData.duration / 60) : 0;

            setRouteInfo({ distance, time });

            // 绘制路线
            const polyline = new AMap.Polyline({
              path: path,
              strokeColor: '#3b82f6',
              strokeWeight: 6,
              strokeOpacity: 0.8,
              lineJoin: 'round',
              lineCap: 'round',
            });

            map.add(polyline);
            map.setFitView([polyline]);
          } else {
            // 使用高德 API 实时规划路线
            const routeConfig = {
              car: { plugin: 'AMap.Driving', policy: policy },
              walk: { plugin: 'AMap.Walking', policy: 0 },
              bike: { plugin: 'AMap.Riding', policy: 0 },
              bus: { plugin: 'AMap.Transfer', policy: policy },
            }[routeType];

            AMap.plugin(routeConfig.plugin, () => {
              if (!isMounted || !mapContainerRef.current) return;

              const RouteService = AMap[routeConfig.plugin];
              const routeService = new RouteService({
                ...(routeType === 'car' && { policy: routeConfig.policy }),
              });

              routeService.search(new AMap.LngLat(fromLng, fromLat), new AMap.LngLat(toLng, toLat), (status: string, result: any) => {
                if (!isMounted) return;

                if (status === 'complete' && result.routes && result.routes.length > 0) {
                  const route = result.routes[0];
                  const distance = route.distance / 1000;
                  const time = Math.ceil(route.time / 60);

                  setRouteInfo({ distance, time });

                  // 绘制路线
                  const path: Array<[number, number]> = [];
                  route.steps.forEach((step: any) => {
                    step.path.forEach((point: any) => {
                      path.push([point.lng, point.lat]);
                    });
                  });

                  const polyline = new AMap.Polyline({
                    path: path,
                    strokeColor: '#3b82f6',
                    strokeWeight: 6,
                    strokeOpacity: 0.8,
                    lineJoin: 'round',
                    lineCap: 'round',
                  });

                  map.add(polyline);
                  map.setFitView([polyline]);
                } else {
                  setMapError('路线规划失败: ' + (result?.info || status));
                }
                setIsLoading(false);
              });
            });
          }
        } else if (location && isValidCoord) {
          // 单点标记模式
          const centerLng = parseFloat(lng);
          const centerLat = parseFloat(lat);

          // 创建地图实例
          const map = new AMap.Map(mapContainerRef.current, {
            zoom: zoom,
            center: [centerLng, centerLat],
            viewMode: '2D',
            resizeEnable: true,
          });

          mapInstanceRef.current = map;

          // 添加标记
          const marker = new AMap.Marker({
            position: [centerLng, centerLat],
            title: name || '标记点',
          });

          map.add(marker);

          // 如果有名称，显示信息窗体
          if (name) {
            const infoWindow = new AMap.InfoWindow({
              content: `<div style="padding: 10px; font-size: 12px;">${name}</div>`,
            });
            infoWindow.open(map, [centerLng, centerLat]);
          }
        } else {
          throw new Error('无效的坐标格式或缺少必要参数');
        }

        setIsLoading(false);
      } catch (error: any) {
        console.error('地图初始化失败:', error);
        setMapError(error.message || '地图加载失败');
        setIsLoading(false);
      }
    };

    initMap();

    // 清理函数
    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, name, zoom, isRouteMode, fromLocation, toLocation, fromName, toName, routeType, policy, routeDataStr]);

  const handleOpenMap = () => {
    window.open(amapUrl, '_blank');
  };

  // 路线类型的中文映射
  const routeTypeNames = {
    car: '驾车',
    walk: '步行',
    bike: '骑行',
    bus: '公交',
  };

  if (mapError) {
    return (
      <div className="border-border bg-muted/30 my-4 overflow-hidden rounded-lg border">
        <div className="flex flex-col items-center justify-center space-y-3 p-8">
          {isRouteMode ? <Navigation className="text-muted-foreground h-12 w-12" /> : <MapPin className="text-muted-foreground h-12 w-12" />}
          <div className="text-center">
            {isRouteMode && from && to ? (
              <>
                <p className="text-foreground text-sm font-medium">
                  {from.name || '起点'} → {to.name || '终点'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {from.location} → {to.location}
                </p>
              </>
            ) : (
              <>
                <p className="text-foreground text-sm font-medium">{name || '地图位置'}</p>
                <p className="text-muted-foreground mt-1 text-xs">坐标: {location}</p>
              </>
            )}
          </div>
          <p className="text-destructive text-sm">{mapError}</p>
          <button
            onClick={handleOpenMap}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            在高德地图中打开
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border bg-muted/30 my-4 w-fit overflow-hidden rounded-lg border">
      {/* 地图标题栏 */}
      <div className="bg-muted/50 border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          {isRouteMode && from && to ? (
            <>
              <Navigation className="text-muted-foreground h-3 w-3" />
              <span className="text-xs">
                {routeTypeNames[routeType]}路线: {from.name || '起点'} → {to.name || '终点'}
              </span>
            </>
          ) : (
            <>
              <MapPin className="text-muted-foreground h-3 w-3" />
              <span className="text-xs">
                {name || '地图'} - {location}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {routeInfo && (
            <div className="text-muted-foreground text-xs">
              距离: {routeInfo.distance.toFixed(2)} 公里 | 时间: {routeInfo.time} 分钟
            </div>
          )}
          <button
            onClick={handleOpenMap}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 text-xs transition-colors"
            title="在高德地图中打开"
          >
            <ExternalLink className="h-3 w-3" />
            外部打开
          </button>
        </div>
      </div>

      {/* 地图容器 */}
      <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
        {isLoading && (
          <div className="bg-muted/50 absolute inset-0 flex items-center justify-center">
            <div className="text-muted-foreground text-sm">加载地图中...</div>
          </div>
        )}
        <div ref={mapContainerRef} className="h-full w-full" style={{ display: isLoading ? 'none' : 'block' }} />
      </div>
    </div>
  );
}
