import { browserExtractContentSchema } from './schema';
import { browserExtractContentExecutor } from './executor';
import { Tool } from '../../registry';

export const browserExtractContentTool: Tool = {
  schema: browserExtractContentSchema,
  executor: browserExtractContentExecutor,
};

