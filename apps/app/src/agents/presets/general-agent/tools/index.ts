import { getCurrentTimeDefinition } from './get-current-time';
import { getCurrentWeatherDefinition } from './get-current-weather';
import { webSearchDefinition } from './web-search';
import { searchNewsDefinition } from './search-news';
import { searchImagesDefinition } from './search-images';
import { generateImageDefinition } from './generate-image';
import { generateVideoDefinition } from './generate-video';
import { generateAudioDefinition } from './generate-audio';
import { generateMusicDefinition } from './generate-music';
import { getAigcModelsDefinition } from './get-aigc-models';
import { getGenerationResultDefinition } from './get-generation-result';
import { waitDefinition } from './wait';

export const GENERAL_TOOLS = [
  getCurrentTimeDefinition,
  getCurrentWeatherDefinition,
  webSearchDefinition,
  searchNewsDefinition,
  searchImagesDefinition,
  generateImageDefinition,
  generateVideoDefinition,
  generateAudioDefinition,
  generateMusicDefinition,
  getAigcModelsDefinition,
  getGenerationResultDefinition,
  waitDefinition,
];
