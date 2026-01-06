import { generatePresentationTool } from './generate-presentation';
import { updatePresentationTool } from './update-presentation';

export * from './generate-presentation';
export * from './update-presentation';

export const presentationToolboxes = [generatePresentationTool, updatePresentationTool];

