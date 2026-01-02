/**
 * JSON 提取工具函数
 * 用于从 AI 返回的文本中提取 JSON 对象或数组
 * 处理常见的格式问题：代码块标记、截断、格式错误等
 */

/**
 * 从文本中提取 JSON（对象或数组）
 * @param text 包含 JSON 的文本
 * @param fixTruncated 是否尝试修复被截断的 JSON，默认为 true
 * @returns 提取的 JSON 对象或数组，如果提取失败返回 null
 */
export function extractJsonFromText<T = any>(text: string, fixTruncated = true): T | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // 移除代码块标记
  const cleanedText = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 尝试直接解析
  try {
    const parsed = JSON.parse(cleanedText);
    return parsed as T;
  } catch {
    // 直接解析失败，尝试提取 JSON
  }

  // 尝试提取 JSON 对象
  const objectMatch = extractJsonObject(cleanedText, fixTruncated);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch) as T;
    } catch {
      // 解析失败，继续尝试数组
    }
  }

  // 尝试提取 JSON 数组
  const arrayMatch = extractJsonArray(cleanedText, fixTruncated);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch) as T;
    } catch {
      // 解析失败
    }
  }

  return null;
}

/**
 * 提取 JSON 对象
 */
function extractJsonObject(text: string, fixTruncated: boolean): string | null {
  // 查找第一个 { 和最后一个 } 之间的内容
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  let jsonStr = text.substring(firstBrace, lastBrace + 1);

  // 如果允许修复截断，尝试修复
  if (fixTruncated) {
    jsonStr = fixTruncatedJson(jsonStr);
  }

  return jsonStr;
}

/**
 * 提取 JSON 数组
 */
function extractJsonArray(text: string, fixTruncated: boolean): string | null {
  // 先尝试匹配完整的数组
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // 如果没有找到完整的数组，尝试查找不完整的数组（可能被截断）
  if (fixTruncated) {
    const arrayStart = text.indexOf('[');
    if (arrayStart !== -1) {
      // 找到数组开始，尝试提取并修复
      const partialArray = text.substring(arrayStart);
      const fixedArray = fixTruncatedJsonArray(partialArray);
      if (fixedArray) {
        return fixedArray;
      }
    }
  }

  return null;
}

/**
 * 修复被截断的 JSON（通用）
 */
function fixTruncatedJson(jsonStr: string): string {
  // 计算未闭合的括号
  const openBraces = (jsonStr.match(/\{/g) || []).length;
  const closeBraces = (jsonStr.match(/\}/g) || []).length;
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/\]/g) || []).length;

  // 添加缺失的闭合括号
  if (openBraces > closeBraces) {
    jsonStr = jsonStr + '}'.repeat(openBraces - closeBraces);
  }
  if (openBrackets > closeBrackets) {
    jsonStr = jsonStr + ']'.repeat(openBrackets - closeBrackets);
  }

  // 移除末尾可能的不完整字符串
  jsonStr = jsonStr.replace(/,\s*"[^"]*$/, '');
  jsonStr = jsonStr.replace(/,\s*[^,}\]]*$/, '');

  return jsonStr;
}

/**
 * 修复被截断的 JSON 数组
 */
function fixTruncatedJsonArray(partialArray: string): string | null {
  let fixedArray = partialArray;

  // 计算未闭合的括号
  const openBrackets = (fixedArray.match(/\[/g) || []).length;
  const closeBrackets = (fixedArray.match(/\]/g) || []).length;

  if (openBrackets > closeBrackets) {
    // 添加缺失的闭合括号
    fixedArray = fixedArray + ']';
  }

  // 移除末尾可能的不完整字符串
  // 匹配：, "不完整的字符串
  fixedArray = fixedArray.replace(/,\s*"[^"]*$/, ']');
  // 匹配：, 其他不完整的内容
  fixedArray = fixedArray.replace(/,\s*[^,}\]]*$/, ']');

  // 验证修复后的数组是否可以解析
  try {
    JSON.parse(fixedArray);
    return fixedArray;
  } catch {
    return null;
  }
}
