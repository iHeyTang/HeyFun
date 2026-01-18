import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { prisma } from '@/lib/server/prisma';
import { configureEnvironmentVariableParamsSchema } from './schema';

export const configureEnvironmentVariableExecutor = definitionToolExecutor(configureEnvironmentVariableParamsSchema, async (args, context) => {
  try {
    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    const { variableNames, descriptions = {} } = args;

    // 将单个字符串转换为数组
    const variableNamesArray = Array.isArray(variableNames) ? variableNames : [variableNames];

    // 获取环境变量配置
    const envVars = await prisma.environmentVariables.findUnique({
      where: { organizationId: context.organizationId },
    });

    const variables: Array<{
      variableName: string;
      exists: boolean;
      description: string;
    }> = [];

    let allConfigured = true;

    if (envVars && envVars.variables && typeof envVars.variables === 'object') {
      const configuredVariables = envVars.variables as Record<string, any>;

      for (const variableName of variableNamesArray) {
        const value = configuredVariables[variableName] || null;
        const exists = value !== null && value !== undefined && value !== '';

        if (!exists) {
          allConfigured = false;
        }

        variables.push({
          variableName,
          exists,
          description: descriptions[variableName] || (exists ? `环境变量 ${variableName} 已配置` : `需要配置环境变量 ${variableName}`),
        });
      }
    } else {
      // 如果没有配置，所有变量都未配置
      allConfigured = false;
      for (const variableName of variableNamesArray) {
        variables.push({
          variableName,
          exists: false,
          description: descriptions[variableName] || `需要配置环境变量 ${variableName}`,
        });
      }
    }

    const configureUrl = `/dashboard/settings/environment-variables`;

    const unconfiguredCount = variables.filter(v => !v.exists).length;
    const configuredCount = variables.filter(v => v.exists).length;

    let message = '';
    if (allConfigured) {
      message = `所有环境变量（${variables.length} 个）都已配置，可以使用。`;
    } else {
      if (configuredCount > 0) {
        message = `已配置 ${configuredCount} 个环境变量，还需要配置 ${unconfiguredCount} 个。`;
      } else {
        message = `需要配置 ${unconfiguredCount} 个环境变量。请填写下方表单进行配置。`;
      }
    }

    // 如果有未配置的变量，设置完结状态为 'configure_environment_variable'
    if (!allConfigured && context.completion) {
      const unconfiguredVariables = variables.filter(v => !v.exists);
      context.completion.setCompletion('configure_environment_variable', 'configure_environment_variable', {
        variables: unconfiguredVariables.map(v => ({
          variableName: v.variableName,
          description: v.description,
        })),
        message,
        configureUrl,
      });
    }

    return {
      success: true,
      data: {
        variables,
        allConfigured,
        configureUrl,
        message,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
