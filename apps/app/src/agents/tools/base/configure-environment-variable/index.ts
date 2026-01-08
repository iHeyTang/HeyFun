import { configureEnvironmentVariableSchema } from './schema';
import { configureEnvironmentVariableExecutor } from './executor';
import { Tool } from '../../registry';

export const configureEnvironmentVariableTool: Tool = {
  schema: configureEnvironmentVariableSchema,
  executor: configureEnvironmentVariableExecutor,
};
