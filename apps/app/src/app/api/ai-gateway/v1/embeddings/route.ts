import { NextRequest, NextResponse } from 'next/server';
import { verifyGatewayAuth, recordGatewayUsage, getModels } from '@/lib/server/gateway';
import { calculateLLMCost, deductCredits, checkCreditsBalance } from '@/lib/server/credit';
import { createProvider } from '@repo/llm/chat';

/**
 * POST /api/ai-gateway/v1/embeddings
 * OpenAI 兼容的嵌入接口
 * 支持两种鉴权模式：
 * 1. API Key 鉴权：Authorization: Bearer <api-key>
 * 2. Clerk 用户鉴权：通过 Clerk session
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let apiKeyId: string | null = null;
  let organizationId: string | null = null;
  let modelId: string | null = null;
  let inputTokens = 0;
  let statusCode = 200;
  let errorMessage: string | null = null;

  try {
    // 验证鉴权（支持 API Key 或 Clerk 用户鉴权）
    const authHeader = request.headers.get('authorization');
    const authInfo = await verifyGatewayAuth(authHeader);

    if (!authInfo) {
      statusCode = 401;
      return NextResponse.json(
        {
          error: {
            message: 'Invalid authorization. Please provide a valid API key or be authenticated via Clerk.',
            type: 'invalid_request_error',
            code: 'invalid_api_key',
          },
        },
        { status: 401 },
      );
    }

    apiKeyId = authInfo.apiKeyId;
    organizationId = authInfo.organizationId;

    // 解析请求体
    const body = await request.json();

    // 验证必需参数
    if (!body.model) {
      statusCode = 400;
      return NextResponse.json(
        {
          error: {
            message: 'Missing required parameter: model',
            type: 'invalid_request_error',
            code: 'missing_parameter',
          },
        },
        { status: 400 },
      );
    }

    if (!body.input) {
      statusCode = 400;
      return NextResponse.json(
        {
          error: {
            message: 'Missing required parameter: input',
            type: 'invalid_request_error',
            code: 'missing_parameter',
          },
        },
        { status: 400 },
      );
    }

    modelId = body.model;

    // 检查模型是否可用
    const availableModels = await getModels();
    const modelInfo = availableModels.find((m: { id: string }) => m.id === modelId);

    if (!modelInfo) {
      statusCode = 404;
      return NextResponse.json(
        {
          error: {
            message: `The model '${modelId}' does not exist or is not available`,
            type: 'invalid_request_error',
            code: 'model_not_found',
          },
        },
        { status: 404 },
      );
    }

    // 验证模型类型为 embedding
    if (modelInfo.type !== 'embedding') {
      statusCode = 400;
      return NextResponse.json(
        {
          error: {
            message: `The model '${modelId}' is not an embedding model`,
            type: 'invalid_request_error',
            code: 'invalid_model_type',
          },
        },
        { status: 400 },
      );
    }

    if (!organizationId) {
      statusCode = 400;
      return NextResponse.json(
        {
          error: {
            message: 'Organization ID is required',
            type: 'invalid_request_error',
            code: 'missing_organization',
          },
        },
        { status: 400 },
      );
    }

    // 估算输入 tokens（简单估算：按字符数 / 4）
    const inputText = Array.isArray(body.input) ? body.input.join(' ') : body.input;
    const estimatedInputTokens = Math.ceil(inputText.length / 4);
    const estimatedCost = calculateLLMCost(modelInfo, estimatedInputTokens, 0);
    const hasBalance = await checkCreditsBalance(organizationId, estimatedCost);
    if (!hasBalance) {
      statusCode = 402;
      return NextResponse.json(
        {
          error: {
            message: 'Insufficient credits balance',
            type: 'insufficient_credits',
            code: 'insufficient_credits',
          },
        },
        { status: 402 },
      );
    }

    // 创建 provider
    const providerId = (modelInfo.metadata?.providerId as string) || modelInfo.provider;

    // 从环境变量获取 API key（与 chat/completions 保持一致）
    let apiKey: string | undefined;
    switch (providerId) {
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        break;
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY;
        break;
      case 'openrouter':
        apiKey = process.env.OPENROUTER_API_KEY;
        break;
      case 'deepseek':
        apiKey = process.env.DEEPSEEK_API_KEY;
        break;
      case 'vercel':
        apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY;
        break;
      default:
        // 尝试通用格式的环境变量
        apiKey = process.env[`${providerId.toUpperCase()}_API_KEY`] || process.env.OPENAI_API_KEY;
    }

    const provider = createProvider(providerId, {
      apiKey,
      baseURL: modelInfo.metadata?.baseURL as string | undefined,
    });

    // 构建 embedding 请求
    const providerModelId = (modelInfo.metadata?.providerModelId as string) || modelId;
    const embeddingRequest = {
      model: providerModelId,
      input: body.input,
      encoding_format: body.encoding_format || 'float',
    };

    // 调用 embedding API
    let response;
    try {
      console.log(`[Gateway] Calling embedding API for model ${modelId}, provider: ${providerId}, organization: ${organizationId}`);
      const httpRequest = provider.buildRequest('/embeddings', embeddingRequest);
      const httpResponse = await provider.sendRequest(httpRequest);

      if (httpResponse.status !== 200) {
        throw new Error(`API error (${httpResponse.status}): ${JSON.stringify(httpResponse.body)}`);
      }

      response = httpResponse.body;
    } catch (error) {
      // 处理外部API返回的错误
      if (error instanceof Error && error.message.includes('API error (402)')) {
        const providerId = (modelInfo.metadata?.providerId as string) || modelInfo.provider;
        console.error(
          `[Gateway] External API provider (${providerId}) returned insufficient balance error for organization ${organizationId}, model: ${modelId}`,
        );
        console.error(`[Gateway] Error details: ${error.message}`);
        statusCode = 402;
        return NextResponse.json(
          {
            error: {
              message: `External API provider (${providerId}) has insufficient balance. Please check your ${providerId} account balance.`,
              type: 'external_api_insufficient_balance',
              code: 'external_api_insufficient_balance',
              provider: providerId,
              details: error.message,
            },
          },
          { status: 402 },
        );
      }
      // 其他错误继续抛出
      throw error;
    }

    // 获取实际使用的 tokens
    inputTokens = response.usage?.prompt_tokens || response.usage?.total_tokens || estimatedInputTokens;

    // 计算并扣除credits
    const cost = calculateLLMCost(modelInfo, inputTokens, 0);
    if (cost > 0) {
      try {
        await deductCredits(organizationId, cost);
      } catch (error) {
        console.error('Failed to deduct credits:', error);
        // 如果扣费失败，返回错误
        statusCode = 402;
        return NextResponse.json(
          {
            error: {
              message: error instanceof Error ? error.message : 'Failed to deduct credits',
              type: 'insufficient_credits',
              code: 'insufficient_credits',
            },
          },
          { status: 402 },
        );
      }
    }

    // 记录使用量（即使 apiKeyId 为 null 也要记录）
    if (organizationId && modelId) {
      await recordGatewayUsage({
        organizationId,
        apiKeyId, // 可以为 null（Clerk 或桌面端鉴权模式）
        modelId,
        endpoint: '/v1/embeddings',
        method: 'POST',
        inputTokens,
        outputTokens: 0,
        totalTokens: inputTokens,
        statusCode: 200,
        responseTime: Date.now() - startTime,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in POST /api/ai-gateway/v1/embeddings:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    statusCode = 500;

    // 记录错误使用量（即使 apiKeyId 为 null 也要记录）
    if (organizationId && modelId) {
      await recordGatewayUsage({
        organizationId,
        apiKeyId, // 可以为 null（Clerk 或桌面端鉴权模式）
        modelId: modelId || 'unknown',
        endpoint: '/v1/embeddings',
        method: 'POST',
        inputTokens,
        outputTokens: 0,
        totalTokens: inputTokens,
        statusCode,
        responseTime: Date.now() - startTime,
        errorMessage,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      });
    }

    return NextResponse.json(
      {
        error: {
          message: errorMessage,
          type: 'server_error',
          code: 'internal_error',
        },
      },
      { status: statusCode },
    );
  }
}

/**
 * OPTIONS for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
