import { browserClickSchema } from './schema';
import { browserClickExecutor } from './executor';
import { Tool } from '../../registry';

export const browserClickTool: Tool = {
  schema: browserClickSchema,
  executor: browserClickExecutor,
};

