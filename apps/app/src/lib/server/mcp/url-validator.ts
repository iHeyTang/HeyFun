/**
 * MCP URL 验证器
 * 防止 SSRF 攻击，只禁止内网地址
 */

export class MCPURLValidator {
  /**
   * 验证 URL 是否安全
   * 只检查是否为内网地址，其他外部 URL 都允许
   */
  static validateURL(url: string): { valid: boolean; reason?: string } {
    try {
      const urlObj = new URL(url);

      // 1. 生产环境只允许 HTTPS
      if (process.env.NODE_ENV === 'production' && urlObj.protocol !== 'https:') {
        return { valid: false, reason: 'Only HTTPS is allowed in production' };
      }

      // 2. 禁止内网地址（防止 SSRF）
      if (this.isPrivateAddress(urlObj.hostname)) {
        return { valid: false, reason: 'Private/internal addresses are not allowed' };
      }

      // 3. 其他外部 URL 都允许
      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  /**
   * 检查是否为内网地址
   */
  private static isPrivateAddress(hostname: string): boolean {
    // 检查是否为内网地址
    const privatePatterns = [
      /^127\./, // 127.0.0.1
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^localhost$/i,
      /^\.local$/i,
      /^169\.254\./, // 链路本地地址（云服务元数据）
      /^::1$/, // IPv6 localhost
      /^fc00:/, // IPv6 私有地址
      /^fe80:/, // IPv6 链路本地
    ];

    return privatePatterns.some(pattern => pattern.test(hostname));
  }
}
