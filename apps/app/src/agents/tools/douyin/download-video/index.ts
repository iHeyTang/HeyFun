import { douyinDownloadVideoSchema } from './schema';
import { douyinDownloadVideoExecutor } from './executor';
import { Tool } from '../../registry';

export const douyinDownloadVideoTool: Tool = {
  schema: douyinDownloadVideoSchema,
  executor: douyinDownloadVideoExecutor,
};
