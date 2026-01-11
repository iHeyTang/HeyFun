import { updatePresentationParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { AssetManager } from '@/lib/server/asset-manager';
import { prisma } from '@/lib/server/prisma';
import { convertLegacyPresentationToNewFormat, type ExtendedLegacySlide } from '../_lib/converter';
import { generateHtmlContent } from '../_lib/renderers/html-renderer';
import { generatePptxBuffer } from '../_lib/renderers/pptx-renderer';

export const updatePresentationExecutor = definitionToolExecutor(updatePresentationParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'update-presentation'}`, async () => {
    try {
      if (!context.sessionId || !context.organizationId) {
        return {
          success: false,
          error: 'Session ID and Organization ID are required',
        };
      }

      const { assetId, title, slides: updateSlides, style: updateStyle, exportFormats: updateExportFormats } = args;

      // 1. 获取原始 Asset
      const originalAsset = await prisma.assets.findFirst({
        where: {
          id: assetId,
          organizationId: context.organizationId,
          deletedAt: null,
          type: 'presentation',
        },
      });

      if (!originalAsset) {
        return {
          success: false,
          error: 'Presentation not found or you do not have permission to access it',
        };
      }

      // 2. 从 metadata 读取原始内容
      const metadata = (originalAsset.metadata as any) || {};
      const originalTitle = metadata.presentationTitle || originalAsset.title?.replace(' (HTML)', '').replace(' (PPTX)', '') || '演示文稿';
      const originalSlides = metadata.slides || [];
      const originalStyle = metadata.style || { theme: 'default', colorScheme: 'light' };
      const originalExportFormats = metadata.exportFormats || ['html'];
      const originalVersion = metadata.version || 1;

      // 3. 合并更新
      const newTitle = title !== undefined ? title : originalTitle;
      const newStyle = updateStyle
        ? {
            ...originalStyle,
            ...updateStyle,
          }
        : originalStyle;
      const newExportFormats = updateExportFormats || originalExportFormats;

      // 4. 处理幻灯片更新
      const newSlides = [...originalSlides];

      if (updateSlides && updateSlides.length > 0) {
        // 先处理删除操作
        const deleteIndices = updateSlides
          .filter(s => s.action === 'delete' && s.index !== undefined)
          .map(s => s.index!)
          .sort((a, b) => b - a); // 从后往前删除，避免索引变化

        for (const index of deleteIndices) {
          if (index >= 0 && index < newSlides.length) {
            newSlides.splice(index, 1);
          }
        }

        // 处理插入和更新操作
        for (const updateSlide of updateSlides) {
          if (updateSlide.action === 'delete') {
            continue; // 已经处理过了
          }

          const { index, action, ...slideData } = updateSlide;
          const isInsert = action === 'insert' || index === undefined;

          if (isInsert) {
            // 插入新幻灯片
            if (index !== undefined && index >= 0 && index <= newSlides.length) {
              newSlides.splice(index, 0, slideData as any);
            } else {
              newSlides.push(slideData as any);
            }
          } else if (index !== undefined && index >= 0 && index < newSlides.length) {
            // 更新现有幻灯片
            newSlides[index] = {
              ...newSlides[index],
              ...slideData,
            };
          }
        }
      }

      // 5. 保存历史版本（将原 Asset 标记为历史版本）
      const historyAssetId = originalAsset.id;
      await prisma.assets.update({
        where: { id: historyAssetId },
        data: {
          metadata: {
            ...metadata,
            isHistory: true,
            historyOf: assetId, // 指向新版本的 assetId（稍后更新）
          },
        },
      });

      // 6. 使用 LLM 进行智能设计决策（如果可用）
      let designedSlides: ExtendedLegacySlide[] = newSlides as ExtendedLegacySlide[];

      if (context.llmClient) {
        try {
          // 复用 generate-presentation 的设计逻辑
          const { designSlidesWithLLM } = await import('../generate-presentation/executor');
          designedSlides = await designSlidesWithLLM(newTitle, newSlides, newStyle, context.llmClient);
        } catch (error) {
          console.error('Failed to design slides with LLM, using fallback:', error);
          designedSlides = newSlides as ExtendedLegacySlide[];
        }
      }

      // 7. 转换为新格式并生成演示文稿
      const presentationData = convertLegacyPresentationToNewFormat(newTitle, designedSlides, newStyle);

      // 生成HTML内容
      let htmlContent = '';
      if (newExportFormats.includes('html')) {
        htmlContent = generateHtmlContent(presentationData);
      }

      // 生成PPTX Buffer
      let pptxBuffer: Buffer | null = null;
      if (newExportFormats.includes('pptx')) {
        try {
          pptxBuffer = await generatePptxBuffer(presentationData);
        } catch (error) {
          console.error('Failed to generate PPTX:', error);
        }
      }

      // 8. 创建新的 Asset 记录
      const assets: Array<{ id: string; fileKey: string; fileUrl: string; type: string }> = [];
      let htmlUrl = '';
      let pptxUrl = '';
      let newAssetId = '';

      // 上传HTML文件
      if (newExportFormats.includes('html') && htmlContent) {
        try {
          const htmlAsset = await AssetManager.createAsset({
            organizationId: context.organizationId,
            sessionId: context.sessionId,
            fileContent: Buffer.from(htmlContent, 'utf-8'),
            fileName: `${newTitle || 'presentation'}.html`,
            mimeType: 'text/html',
            type: 'presentation',
            title: `${newTitle || '演示文稿'} (HTML)`,
            description: `HTML版本的演示文稿：${newTitle}`,
            toolCallId: context.toolCallId,
            messageId: context.messageId,
            metadata: {
              presentationTitle: newTitle,
              slides: newSlides,
              style: newStyle,
              exportFormats: newExportFormats,
              version: originalVersion + 1,
              isHistory: false,
              previousVersionId: historyAssetId,
            },
          });
          assets.push(htmlAsset);
          htmlUrl = htmlAsset.fileUrl;
          newAssetId = htmlAsset.id;
        } catch (error) {
          console.error('Failed to upload HTML:', error);
        }
      }

      // 上传PPTX文件
      if (newExportFormats.includes('pptx') && pptxBuffer) {
        try {
          const pptxAsset = await AssetManager.createAsset({
            organizationId: context.organizationId,
            sessionId: context.sessionId,
            fileContent: pptxBuffer,
            fileName: `${newTitle || 'presentation'}.pptx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            type: 'presentation',
            title: `${newTitle || '演示文稿'} (PPTX)`,
            description: `PPTX版本的演示文稿：${newTitle}`,
            toolCallId: context.toolCallId,
            messageId: context.messageId,
            metadata: {
              presentationTitle: newTitle,
              slides: newSlides,
              style: newStyle,
              exportFormats: newExportFormats,
              version: originalVersion + 1,
              isHistory: false,
              previousVersionId: historyAssetId,
              presentationData: presentationData,
            },
          });
          assets.push(pptxAsset);
          pptxUrl = pptxAsset.fileUrl;
          if (!newAssetId) {
            newAssetId = pptxAsset.id;
          }
        } catch (error) {
          console.error('Failed to upload PPTX:', error);
        }
      }

      // 9. 更新历史版本的 metadata，指向新版本
      if (newAssetId) {
        await prisma.assets.update({
          where: { id: historyAssetId },
          data: {
            metadata: {
              ...metadata,
              isHistory: true,
              historyOf: newAssetId,
            },
          },
        });
      }

      return {
        success: true,
        data: {
          htmlUrl: htmlUrl || undefined,
          pptxUrl: pptxUrl || undefined,
          assets: assets.map(a => ({
            id: a.id,
            fileKey: a.fileKey,
            fileUrl: a.fileUrl,
            type: a.type,
          })),
          historyAssetId: historyAssetId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
});
