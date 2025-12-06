/**
 * 智能识别 contextLength 是基于 1024 还是 1000，并选择最合适的值进行转换
 */
export const formatContextLength = (contextLength: number) => {
  // 如果小于 1000，直接显示原始数字
  if (contextLength < 1000) {
    return contextLength.toLocaleString();
  }

  // 计算除以 1024 和 1000 的余数，判断哪个更接近整数
  const remainder1024 = contextLength % 1024;
  const remainder1000 = contextLength % 1000;

  // 计算相对余数（余数占基数的比例），越小说明越接近整数倍
  const relativeRemainder1024 = remainder1024 / 1024;
  const relativeRemainder1000 = remainder1000 / 1000;

  // 选择相对余数更小的基数，如果相等则优先使用 1024（计算机科学中更常见）
  const base = relativeRemainder1024 <= relativeRemainder1000 ? 1024 : 1000;
  const value = contextLength / base;

  // 如果值很大（>= 1000），转换为更大的单位，使用相同的基数
  if (value >= 1000) {
    const mb = value / (base === 1024 ? 1024 : 1000);
    return `${mb.toLocaleString()}M`;
  }

  return `${value.toLocaleString()}K`;
};
