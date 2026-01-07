import { browserNavigateSchema } from './schema';
import { browserNavigateExecutor } from './executor';
import { Tool } from '../../registry';

export const browserNavigateTool: Tool = {
  schema: browserNavigateSchema,
  executor: browserNavigateExecutor,
};

