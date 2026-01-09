import { NextRequest, NextResponse } from 'next/server';
import { verifyGatewayAuth, recordGatewayUsage, getModels } from '@/lib/server/gateway';
import { calculateLLMCost, deductCredits, checkCreditsBalance } from '@/lib/server/credit';
import CHAT, { UnifiedChat } from '@/llm/chat';

/**
 * POST /api/ai-gateway/v1/chat/completions
 * OpenAI 兼容的聊天完成接口
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
  let outputTokens = 0;
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

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      statusCode = 400;
      return NextResponse.json(
        {
          error: {
            message: 'Missing required parameter: messages',
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
    const modelAvailable = availableModels.some((m: { id: string }) => m.id === modelId);
    if (!modelAvailable) {
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

    // 创建LLM客户端
    if (!modelId) {
      statusCode = 400;
      return NextResponse.json(
        {
          error: {
            message: 'Model ID is required',
            type: 'invalid_request_error',
            code: 'missing_parameter',
          },
        },
        { status: 400 },
      );
    }

    // 设置模型列表到 CHAT 实例
    CHAT.setModels(availableModels);
    const llmClient = CHAT.createClient(modelId);

    // 获取模型信息用于计算费用
    const modelInfo = availableModels.find((m: { id: string }) => m.id === modelId);
    if (!modelInfo) {
      statusCode = 404;
      return NextResponse.json(
        {
          error: {
            message: `Model '${modelId}' not found`,
            type: 'invalid_request_error',
            code: 'model_not_found',
          },
        },
        { status: 404 },
      );
    }

    // 转换消息格式
    const messages: UnifiedChat.Message[] = body.messages.map((msg: any): UnifiedChat.Message => {
      const baseMsg: any = {
        role: msg.role,
        content: msg.content,
      };

      // 处理工具调用
      if (msg.tool_calls) {
        baseMsg.tool_calls = msg.tool_calls;
      }
      if (msg.tool_call_id) {
        baseMsg.tool_call_id = msg.tool_call_id;
      }

      return baseMsg;
    });

    // 构建聊天参数
    const chatParams: UnifiedChat.ChatCompletionParams = {
      messages,
      temperature: body.temperature,
      top_p: body.top_p,
      max_tokens: body.max_tokens,
      stream: body.stream === true,
      stop: body.stop,
      tools: body.tools,
      tool_choice: body.tool_choice,
      presence_penalty: body.presence_penalty,
      frequency_penalty: body.frequency_penalty,
    };

    // 处理流式响应
    if (body.stream === true) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // 在开始前检查余额（估算，使用请求的max_tokens）
            if (!organizationId) {
              const errorData = `data: ${JSON.stringify({
                error: {
                  message: 'Organization ID is required',
                  type: 'invalid_request_error',
                  code: 'missing_organization',
                },
              })}\n\n`;
              controller.enqueue(encoder.encode(errorData));
              controller.close();
              return;
            }

            const estimatedOutputTokens = body.max_tokens || 1000;
            const estimatedCost = calculateLLMCost(modelInfo, 0, estimatedOutputTokens);
            const hasBalance = await checkCreditsBalance(organizationId, estimatedCost);
            if (!hasBalance) {
              const errorData = `data: ${JSON.stringify({
                error: {
                  message: 'Insufficient credits balance',
                  type: 'insufficient_credits',
                  code: 'insufficient_credits',
                },
              })}\n\n`;
              controller.enqueue(encoder.encode(errorData));
              controller.close();
              return;
            }

            // 调用外部API流式接口
            let streamGenerator;
            try {
              const providerId = (modelInfo.metadata?.providerId as string) || modelInfo.provider;
              console.log(`[Gateway] Calling external API stream for model ${modelId}, provider: ${providerId}, organization: ${organizationId}`);
              streamGenerator = llmClient.chatStream(chatParams);
            } catch (error) {
              // 处理外部API返回的错误
              if (error instanceof Error && error.message.includes('API error (402)')) {
                const providerId = (modelInfo.metadata?.providerId as string) || modelInfo.provider;
                console.error(
                  `[Gateway] External API provider (${providerId}) returned insufficient balance error for organization ${organizationId}, model: ${modelId}`,
                );
                console.error(`[Gateway] Error details: ${error.message}`);
                const errorData = `data: ${JSON.stringify({
                  error: {
                    message: `External API provider (${providerId}) has insufficient balance. Please check your ${providerId} account balance.`,
                    type: 'external_api_insufficient_balance',
                    code: 'external_api_insufficient_balance',
                    provider: providerId,
                    details: error.message,
                  },
                })}\n\n`;
                controller.enqueue(encoder.encode(errorData));
                controller.close();
                return;
              }
              // 其他错误继续抛出
              throw error;
            }
            let fullContent = '';

            try {
              for await (const chunk of streamGenerator) {
                // 发送SSE格式的数据
                const data = `data: ${JSON.stringify(chunk)}\n\n`;
                controller.enqueue(encoder.encode(data));

                // 累积token使用量
                if (chunk.usage) {
                  inputTokens += chunk.usage.prompt_tokens || 0;
                  outputTokens += chunk.usage.completion_tokens || 0;
                }

                // 检查是否完成
                if (chunk.choices?.[0]?.finish_reason) {
                  fullContent = chunk.choices[0].delta?.content || fullContent;
                }
              }
            } catch (streamError) {
              // 处理流式过程中的错误
              if (streamError instanceof Error && streamError.message.includes('API error (402)')) {
                console.error(
                  `[Gateway] External API provider returned insufficient balance error during streaming for organization ${organizationId}`,
                );
                const errorData = `data: ${JSON.stringify({
                  error: {
                    message: 'External API provider has insufficient balance. Please check your API provider account balance.',
                    type: 'external_api_insufficient_balance',
                    code: 'external_api_insufficient_balance',
                    details: streamError.message,
                  },
                })}\n\n`;
                controller.enqueue(encoder.encode(errorData));
                controller.close();
                return;
              }
              // 其他错误继续抛出，由外层catch处理
              throw streamError;
            }

            // 发送结束标记
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();

            // 计算并扣除credits
            const cost = calculateLLMCost(modelInfo, inputTokens, outputTokens);
            if (cost > 0 && organizationId) {
              try {
                await deductCredits(organizationId, cost);
              } catch (error) {
                console.error('Failed to deduct credits after stream completion:', error);
                // 注意：这里不抛出错误，因为响应已经发送给客户端了
              }
            }

            // 记录使用量（即使 apiKeyId 为 null 也要记录）
            if (organizationId && modelId) {
              await recordGatewayUsage({
                organizationId,
                apiKeyId, // 可以为 null（Clerk 或桌面端鉴权模式）
                modelId,
                endpoint: '/v1/chat/completions',
                method: 'POST',
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                statusCode: 200,
                responseTime: Date.now() - startTime,
                ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
              });
            }
          } catch (error) {
            errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorData = `data: ${JSON.stringify({
              error: {
                message: errorMessage,
                type: 'server_error',
                code: 'internal_error',
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();

            // 记录错误使用量（即使 apiKeyId 为 null 也要记录）
            if (organizationId && modelId) {
              await recordGatewayUsage({
                organizationId,
                apiKeyId, // 可以为 null（Clerk 或桌面端鉴权模式）
                modelId,
                endpoint: '/v1/chat/completions',
                method: 'POST',
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                statusCode: 500,
                responseTime: Date.now() - startTime,
                errorMessage,
                ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
              });
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // 非流式响应
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

    // 在调用前检查余额（估算）
    const estimatedOutputTokens = body.max_tokens || 1000;
    const estimatedCost = calculateLLMCost(modelInfo, 0, estimatedOutputTokens);
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

    // 调用外部API
    let response;
    try {
      // 记录使用的模型和 provider 信息
      const providerId = (modelInfo.metadata?.providerId as string) || modelInfo.provider;
      console.log(`[Gateway] Calling external API for model ${modelId}, provider: ${providerId}, organization: ${organizationId}`);
      response = await llmClient.chat(chatParams);
    } catch (error) {
      // 处理外部API返回的错误
      if (error instanceof Error && error.message.includes('API error (402)')) {
        // 外部API提供商（如Vercel AI Gateway）余额不足
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
    inputTokens = response.usage?.prompt_tokens || 0;
    outputTokens = response.usage?.completion_tokens || 0;

    // 计算并扣除credits
    const cost = calculateLLMCost(modelInfo, inputTokens, outputTokens);
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
        endpoint: '/v1/chat/completions',
        method: 'POST',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        statusCode: 200,
        responseTime: Date.now() - startTime,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in POST /api/gateway/v1/chat/completions:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    statusCode = 500;

    // 记录错误使用量（即使 apiKeyId 为 null 也要记录）
    if (organizationId && modelId) {
      await recordGatewayUsage({
        organizationId,
        apiKeyId, // 可以为 null（Clerk 或桌面端鉴权模式）
        modelId: modelId || 'unknown',
        endpoint: '/v1/chat/completions',
        method: 'POST',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
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
