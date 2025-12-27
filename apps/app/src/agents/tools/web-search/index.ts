import { webSearchTool } from './web-search';
import { imageSearchTool } from './image-search';

export * from './web-search';
export * from './image-search';

export const webSearchToolboxes = [webSearchTool, imageSearchTool];
