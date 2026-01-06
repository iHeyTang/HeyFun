import { webSearchTool } from './web-search';
import { imageSearchTool } from './image-search';
import { wikiSearchTool } from './wiki-search';

export * from './web-search';
export * from './image-search';
export * from './wiki-search';

export const webSearchToolboxes = [webSearchTool, imageSearchTool, wikiSearchTool];
