/**
 * 地图相关的工具函数
 * 用于在 HTML 标签和 JSON 数据格式之间转换
 */

/**
 * 将 <map-embed> 标签的属性转换为 JSON 数据格式（用于 Markdown 注释）
 */
export function mapEmbedAttrsToJSON(attrs: Record<string, any>): Record<string, any> {
  const mapData: Record<string, any> = {};

  // 判断是路径规划模式还是单点模式
  const isRouteMode = attrs['data-from-location'] && attrs['data-to-location'];

  if (isRouteMode) {
    // 路径规划模式
    mapData.from = {
      location: attrs['data-from-location'],
    };
    if (attrs['data-from-name']) {
      mapData.from.name = attrs['data-from-name'];
    }

    mapData.to = {
      location: attrs['data-to-location'],
    };
    if (attrs['data-to-name']) {
      mapData.to.name = attrs['data-to-name'];
    }

    if (attrs['data-route-type']) {
      mapData.routeType = attrs['data-route-type'];
    }
    if (attrs['data-policy']) {
      mapData.policy = parseInt(attrs['data-policy'], 10);
    }
    if (attrs['data-route-data']) {
      try {
        mapData.routeData = JSON.parse(attrs['data-route-data']);
      } catch (e) {
        // 解析失败则忽略
      }
    }
  } else {
    // 单点模式
    if (attrs.location) {
      mapData.location = attrs.location;
    }
    if (attrs.name) {
      mapData.name = attrs.name;
    }
    if (attrs.zoom) {
      mapData.zoom = parseInt(attrs.zoom, 10);
    }
  }

  // 宽度和高度（两种模式都支持）
  if (attrs.width) {
    mapData.width = parseInt(attrs.width, 10);
  }
  if (attrs.height) {
    mapData.height = parseInt(attrs.height, 10);
  }

  return mapData;
}

/**
 * 将 JSON 数据格式转换为 <map-embed> 标签的属性（从 Markdown 注释）
 */
export function jsonToMapEmbedAttrs(mapData: Record<string, any>): string[] {
  const attrs: string[] = [];

  // 判断是路径规划模式还是单点模式
  const isRouteMode = mapData.from && mapData.to;

  if (isRouteMode) {
    // 路径规划模式
    attrs.push(`data-from-location="${(mapData.from.location || '').replace(/"/g, '&quot;')}"`);
    if (mapData.from.name) {
      attrs.push(`data-from-name="${(mapData.from.name || '').replace(/"/g, '&quot;')}"`);
    }
    attrs.push(`data-to-location="${(mapData.to.location || '').replace(/"/g, '&quot;')}"`);
    if (mapData.to.name) {
      attrs.push(`data-to-name="${(mapData.to.name || '').replace(/"/g, '&quot;')}"`);
    }
    if (mapData.routeType) {
      attrs.push(`data-route-type="${mapData.routeType}"`);
    }
    if (mapData.policy !== undefined) {
      attrs.push(`data-policy="${mapData.policy}"`);
    }
    if (mapData.routeData) {
      attrs.push(`data-route-data="${JSON.stringify(mapData.routeData).replace(/"/g, '&quot;')}"`);
    }
  } else {
    // 单点模式
    attrs.push(`location="${(mapData.location || '').replace(/"/g, '&quot;')}"`);
    if (mapData.name) {
      attrs.push(`name="${(mapData.name || '').replace(/"/g, '&quot;')}"`);
    }
    if (mapData.zoom !== undefined) {
      attrs.push(`zoom="${mapData.zoom}"`);
    }
  }

  // 宽度和高度（两种模式都支持）
  if (mapData.width) {
    attrs.push(`width="${mapData.width}"`);
  }
  if (mapData.height) {
    attrs.push(`height="${mapData.height}"`);
  }

  return attrs;
}
