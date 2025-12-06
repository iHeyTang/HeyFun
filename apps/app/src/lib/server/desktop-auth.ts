/**
 * 桌面端认证相关的共享常量和工具函数
 */

/**
 * 获取桌面端 JWT token 的 SECRET
 * 确保生成和验证时使用相同的 SECRET
 */
export function getDesktopAuthSecret(): Uint8Array {
  const secret = process.env.CLERK_SECRET_KEY;
  return new TextEncoder().encode(secret);
}
