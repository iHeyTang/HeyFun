import { getAigcModelsTool } from './get-aigc-models';
import { generateImageTool } from './generate-image';
import { generateVideoTool } from './generate-video';
import { generateAudioTool } from './generate-audio';
import { generateMusicTool } from './generate-music';
import { transcribeMediaTool } from './transcribe-media';

export * from './get-aigc-models';
export * from './generate-image';
export * from './generate-video';
export * from './generate-audio';
export * from './generate-music';
export * from './transcribe-media';

export const aigcToolboxes = [getAigcModelsTool, generateImageTool, generateVideoTool, generateAudioTool, generateMusicTool, transcribeMediaTool];
