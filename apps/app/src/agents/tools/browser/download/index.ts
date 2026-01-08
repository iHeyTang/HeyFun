import { browserDownloadSchema } from './schema';
import { browserDownloadExecutor } from './executor';
import { Tool } from '../../registry';

export const browserDownloadTool: Tool = {
  schema: browserDownloadSchema,
  executor: browserDownloadExecutor,
};
