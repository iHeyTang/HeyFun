import { getCurrentWeatherTool } from './get-current-weather';
import { geocodeTool } from './geocode';
import { reverseGeocodeTool } from './reverse-geocode';
import { searchPoiTool } from './search-poi';
import { routePlanningTool } from './route-planning';
import { calculateDistanceTool } from './calculate-distance';

export * from './get-current-weather';
export * from './geocode';
export * from './reverse-geocode';
export * from './search-poi';
export * from './route-planning';
export * from './calculate-distance';

export const amapToolboxes = [getCurrentWeatherTool, geocodeTool, reverseGeocodeTool, searchPoiTool, routePlanningTool, calculateDistanceTool];
