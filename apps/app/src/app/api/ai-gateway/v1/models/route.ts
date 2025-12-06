import { NextRequest, NextResponse } from 'next/server';
import { verifyGatewayAuth, getAvailableModels } from '@/lib/server/gateway';

/**
 * GET /api/ai-gateway/v1/models
 * 获取可用模型列表（OpenAI兼容）
 * 支持两种鉴权模式：
 * 1. API Key 鉴权：Authorization: Bearer <api-key>
 * 2. Clerk 用户鉴权：通过 Clerk session
 */
export const GET = async (request: NextRequest) => {
  try {
    // 验证鉴权（支持 API Key 或 Clerk 用户鉴权）
    const authHeader = request.headers.get('authorization');
    const authInfo = await verifyGatewayAuth(authHeader);

    if (!authInfo) {
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

    // 获取可用模型
    const models = await getAvailableModels(authInfo.organizationId);

    return NextResponse.json({
      object: 'list',
      data: models,
    });
  } catch (error) {
    console.error('Error in GET /api/ai-gateway/v1/models:', error);
    return NextResponse.json(
      {
        error: {
          message: 'Internal server error',
          type: 'server_error',
          code: 'internal_error',
        },
      },
      { status: 500 },
    );
  }
};

/**
 * OPTIONS for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
