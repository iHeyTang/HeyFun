import { prisma } from './prisma';
import type { ModelInfo } from '@/llm/chat';

/**
 * 根据模型定价和token使用量计算费用
 * @param modelInfo 模型信息（包含pricing）
 * @param inputTokens 输入token数量
 * @param outputTokens 输出token数量
 * @returns 费用（credits）
 */
export function calculateLLMCost(modelInfo: ModelInfo, inputTokens: number, outputTokens: number): number {
  const pricing = modelInfo.pricing;
  if (!pricing) {
    // 如果没有定价信息，返回0（免费模型）
    return 0;
  }

  const inputPrice = pricing.input ? Number(pricing.input) : 0;
  const outputPrice = pricing.output ? Number(pricing.output) : 0;

  // 计算费用：inputTokens * inputPrice + outputTokens * outputPrice
  const cost = inputTokens * inputPrice + outputTokens * outputPrice;

  // 向上取整（credits是整数）
  return Math.ceil(cost);
}

/**
 * 检查并扣除credits
 * @param organizationId 组织ID
 * @param cost 需要扣除的费用
 * @returns 是否成功扣除
 */
export async function deductCredits(organizationId: string, cost: number): Promise<boolean> {
  if (cost <= 0) {
    // 免费调用，不需要扣费
    return true;
  }

  try {
    // 使用事务确保原子性
    const result = await prisma.$transaction(async tx => {
      // 获取当前余额
      const credit = await tx.credit.findUnique({
        where: { organizationId },
      });

      if (!credit) {
        // 如果没有credit记录，创建一条
        const newCredit = await tx.credit.create({
          data: {
            organizationId,
            amount: 0,
          },
        });

        if (newCredit.amount < cost) {
          throw new Error('Insufficient balance');
        }

        // 扣除费用
        return await tx.credit.update({
          where: { organizationId },
          data: { amount: { decrement: cost } },
        });
      }

      // 检查余额是否足够
      if (credit.amount < cost) {
        throw new Error('Insufficient balance');
      }

      // 扣除费用
      return await tx.credit.update({
        where: { organizationId },
        data: { amount: { decrement: cost } },
      });
    });

    console.log(`Deducted ${cost} credits from organization ${organizationId}, remaining: ${result.amount}`);
    return true;
  } catch (error) {
    console.error(`Failed to deduct credits for organization ${organizationId}:`, error);
    throw error;
  }
}

/**
 * 检查credits余额是否足够
 * @param organizationId 组织ID
 * @param cost 需要检查的费用
 * @returns 是否足够
 */
export async function checkCreditsBalance(organizationId: string, cost: number): Promise<boolean> {
  if (cost <= 0) {
    return true;
  }

  const credit = await prisma.credit.findUnique({
    where: { organizationId },
  });

  if (!credit) {
    console.log(`[Credit Check] Organization ${organizationId}: No credit record found, balance insufficient`);
    return false;
  }

  const hasBalance = credit.amount >= cost;
  console.log(`[Credit Check] Organization ${organizationId}: Current balance: ${credit.amount}, Required: ${cost}, Sufficient: ${hasBalance}`);
  return hasBalance;
}
