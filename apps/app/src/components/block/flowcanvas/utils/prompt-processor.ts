import { BaseNodeActionData } from '../types/nodes';
/**
 * 处理 Prompt 中的 @text:nodeId 提及
 * 将提及替换为对应节点的文本内容
 *
 * @param prompt - 原始 Prompt
 * @param textNodes - 文本节点输入数组（支持可选的 texts 字段）
 * @returns 处理后的 Prompt
 *
 * @example
 * const prompt = "生成图片：@text:node-123 的风格";
 * const textNodes = [{ nodeId: "node-123", texts: ["水墨画"] }];
 * const result = processTextMentions(prompt, textNodes);
 * // result: "生成图片：水墨画 的风格"
 */
function processTextMentions(prompt: string, textNodes: BaseNodeActionData['input']['texts']): string {
  if (!prompt || textNodes.length === 0) {
    return prompt;
  }

  const textPattern = /@text:([^\s]+)/g;
  let processedPrompt = prompt;

  const matches = [...prompt.matchAll(textPattern)];

  for (const match of matches) {
    const nodeId = match[1];
    if (!nodeId) continue;

    const textNode = textNodes.find(node => node.nodeId === nodeId);
    const text = textNode?.texts?.list?.[0];

    if (text) {
      processedPrompt = processedPrompt.replace(match[0], text);
    }
  }

  return processedPrompt;
}

/**
 * 图片提及处理结果
 */
export interface ImageMentionResult {
  /** 处理后的 Prompt（图片提及被替换为"图X"） */
  processedPrompt: string;
  /** 提及的图片 key 数组 */
  mentionedImages: string[];
}

/**
 * 处理 Prompt 中的 @image:imageKey 提及
 * 将提及替换为"图1"、"图2"等，并返回提及的图片列表
 *
 * @param prompt - 原始 Prompt
 * @param availableImages - 可用的图片 id 数组（格式：image:nodeId:imageKey）
 * @returns 处理结果，包含处理后的 Prompt 和提及的真实图片 key 列表
 *
 * @example
 * const prompt = "参考@image:image:node-123:img1 和 @image:image:node-456:img2 生成新图";
 * const images = ["image:node-123:img1", "image:node-456:img2"];
 * const result = processImageMentions(prompt, images);
 * // result: {
 * //   processedPrompt: "参考图1 和 图2 生成新图",
 * //   mentionedImages: ["img1", "img2"]
 * // }
 */
function processImageMentions(prompt: string, availableImages: string[]): ImageMentionResult {
  if (!prompt || availableImages.length === 0) {
    return {
      processedPrompt: prompt,
      mentionedImages: [],
    };
  }

  const imagePattern = /@image:([^\s]+)/g;
  let processedPrompt = prompt;
  const mentionedImages: string[] = [];

  const matches = [...prompt.matchAll(imagePattern)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (!match) continue;

    const fullImageId = match[1];
    if (!fullImageId) continue;

    const imageExists = availableImages.includes(fullImageId);

    if (imageExists) {
      // 从 image:nodeId:imageKey 格式中提取真实的 imageKey
      const parts = fullImageId.split(':');
      const actualImageKey = parts.length >= 3 ? (parts[parts.length - 1] ?? fullImageId) : fullImageId;

      mentionedImages.push(actualImageKey);
      processedPrompt = processedPrompt.replace(match[0], `图${i + 1}`);
    }
  }

  return {
    processedPrompt,
    mentionedImages,
  };
}

/**
 * 组合处理 Prompt 中的所有提及类型
 * 先处理 @text 提及，再处理 @image 提及
 *
 * @param prompt - 原始 Prompt
 * @param options - 处理选项
 * @returns 完整的处理结果
 *
 * @example
 * const result = processAllMentions(
 *   "基于@text:node1 风格，参考@image:img1 生成",
 *   {
 *     textNodes: [{ nodeId: "node1", texts: ["油画"] }],
 *     availableImages: ["img1"]
 *   }
 * );
 * // result: {
 * //   processedPrompt: "基于油画 风格，参考图1 生成",
 * //   mentionedImages: ["img1"]
 * // }
 */
export function processMentions(
  prompt: string,
  options: {
    textNodes?: BaseNodeActionData['input']['texts'];
    availableImages?: BaseNodeActionData['input']['images'];
  },
): ImageMentionResult {
  let processedPrompt = prompt;
  let mentionedImages: string[] = [];

  // 先处理文本提及
  if (options.textNodes && options.textNodes.length > 0) {
    processedPrompt = processTextMentions(processedPrompt, options.textNodes);
  }

  // 再处理图片提及
  if (options.availableImages && options.availableImages.length > 0) {
    const result = processImageMentions(
      processedPrompt,
      options.availableImages.flatMap(i => i.images?.list || []),
    );
    processedPrompt = result.processedPrompt;
    mentionedImages = result.mentionedImages;
  }

  return {
    processedPrompt,
    mentionedImages,
  };
}
