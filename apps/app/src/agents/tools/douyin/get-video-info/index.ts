import { douyinGetVideoInfoSchema } from './schema';
import { douyinGetVideoInfoExecutor } from './executor';
import { Tool } from '../../registry';

export const douyinGetVideoInfoTool: Tool = {
  schema: douyinGetVideoInfoSchema,
  executor: douyinGetVideoInfoExecutor,
};
