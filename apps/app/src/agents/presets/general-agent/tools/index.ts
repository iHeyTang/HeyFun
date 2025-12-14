import { getCurrentTimeDefinition } from './get-current-time';
import { getCurrentWeatherDefinition } from './get-current-weather';
import { webSearchDefinition } from './web-search';
import { searchNewsDefinition } from './search-news';
import { searchImagesDefinition } from './search-images';

export const GENERAL_TOOLS = [
  getCurrentTimeDefinition,
  getCurrentWeatherDefinition,
  webSearchDefinition,
  searchNewsDefinition,
  searchImagesDefinition,
];

