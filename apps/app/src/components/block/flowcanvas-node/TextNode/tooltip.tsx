import { NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { FlowCanvasTextEditor, FlowCanvasTextEditorRef } from '@/components/block/flowcanvas/components/FlowCanvasTextEditor';
import { ModelSelectorDialog, ModelSelectorRef } from '@/components/features/model-selector';
import { Button } from '@/components/ui/button';
import { useLLM } from '@/hooks/use-llm';
import { ModelInfo } from '@repo/llm/chat';
import { WandSparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { memo, useEffect, useRef, useState } from 'react';
import { TextNodeActionData, TextNodeProcessor } from './processor';

export interface TextNodeTooltipProps {
  nodeId: string;
  value?: TextNodeActionData;
  onValueChange?: (data: TextNodeActionData) => void;
  onSubmitSuccess?: (generatedText: string) => void;
}

const processor = new TextNodeProcessor();

const TextNodeTooltipComponent = ({ nodeId, value: actionData, onValueChange, onSubmitSuccess }: TextNodeTooltipProps) => {
  const t = useTranslations('flowcanvas.nodeTooltips.text');
  const tCommon = useTranslations('flowcanvas.nodeTooltips.common');

  const flowGraph = useFlowGraph();
  const { updateStatus } = useNodeStatusById(nodeId);
  const { availableModels: models } = useLLM();
  const [localPrompt, setLocalPrompt] = useState(actionData?.prompt || '');
  const modelSelectorRef = useRef<ModelSelectorRef>(null);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const editorRef = useRef<FlowCanvasTextEditorRef>(null);

  // 当外部值改变时同步本地状态
  useEffect(() => {
    // 使用 requestAnimationFrame 避免同步 setState
    requestAnimationFrame(() => {
      if (actionData?.prompt !== undefined) {
        setLocalPrompt(actionData.prompt);
      }
      if (actionData?.modelId !== undefined) {
        setSelectedModel(models.find(model => model.id === actionData.modelId) || null);
      }
    });
  }, [actionData?.prompt, actionData?.modelId, models]);

  const handleSubmit = async () => {
    onValueChange?.({ prompt: localPrompt, modelId: selectedModel?.id });
    updateStatus(NodeStatus.PROCESSING);
    try {
      const node = flowGraph.getNodeById(nodeId)!;
      const inputs = flowGraph.getNodeInputsById(nodeId);

      const inputImages = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, images: value.images }));
      const inputTexts = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, texts: value.texts }));
      const inputVideos = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, videos: value.videos }));
      const inputAudios = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, audios: value.audios }));
      const inputMusics = Array.from(inputs.entries()).map(([key, value]) => ({ nodeId: key, musics: value.musics }));

      const result = await processor.execute({
        input: { images: inputImages, texts: inputTexts, videos: inputVideos, audios: inputAudios, musics: inputMusics },
        actionData: { ...node.data.actionData, prompt: editorRef.current?.getText() },
      });
      const generatedText = result.data?.texts?.[0] || '';
      updateStatus(NodeStatus.COMPLETED);
      onSubmitSuccess?.(generatedText);
    } catch (error) {
      updateStatus(NodeStatus.FAILED);
      console.error('AI文本生成失败:', error);
    }
  };

  // 模拟AI文本生成函数
  const generateTextFromPrompt = async (prompt: string, model: string): Promise<string> => {
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 根据提示词生成文本（这里是模拟，实际应该调用真实的AI API）
    const responses = [
      `基于您的提示"${prompt}"，我生成了以下内容：\n\n这是一个由${model}模型生成的示例文本。在实际应用中，这里会调用真实的AI文本生成服务来根据您的提示词创建相关内容。`,
      `根据提示词"${prompt}"生成的内容：\n\n人工智能正在快速发展，改变着我们的生活方式。从智能助手到自动驾驶，AI技术正在各个领域展现其强大的能力。`,
      `${prompt}\n\n以上是根据您的要求生成的文本内容。您可以继续编辑或使用此文本作为起点。`,
    ];

    return responses[Math.floor(Math.random() * responses.length)] || '';
  };

  const handlePromptChange = (newPrompt: string) => {
    // 始终更新本地状态以显示用户输入
    setLocalPrompt(newPrompt);
    onValueChange?.({ prompt: newPrompt, modelId: selectedModel?.id });
  };

  return (
    <div className="overflow-hidden rounded-lg p-4">
      {/* 上半部分：多行文本输入框 */}
      <FlowCanvasTextEditor
        value={localPrompt}
        onChange={handlePromptChange}
        placeholder={t('placeholder')}
        className="border-none! outline-none! h-24 w-full resize-none"
        nodeId={nodeId}
        ref={editorRef}
      />

      {/* 下半部分：Footer - 模型选择和提交按钮 */}
      <div className="flex items-center justify-between">
        {/* 左侧：模型选择 */}
        <Button variant="outline" size="sm" className="justify-start p-4" onClick={() => modelSelectorRef.current?.open()}>
          <span>{selectedModel?.name || t('selectModel')}</span>
        </Button>
        {/* 右侧：提交按钮 */}
        <Button onClick={handleSubmit} onMouseDown={(e: React.MouseEvent) => e.stopPropagation()} className="ml-8 cursor-pointer" size="icon">
          <WandSparkles />
        </Button>
      </div>
      <ModelSelectorDialog ref={modelSelectorRef} selectedModel={selectedModel} onModelSelect={setSelectedModel} type="language" />
    </div>
  );
};

// 使用 memo 优化组件，只有当初始值真正改变时才重新渲染
export const TextNodeTooltip = memo(TextNodeTooltipComponent, (prevProps, nextProps) => {
  // 现在只需要比较初始值，因为我们不会在输入过程中触发外部更新
  return (
    prevProps.value?.prompt === nextProps.value?.prompt &&
    prevProps.onValueChange === nextProps.onValueChange &&
    prevProps.onSubmitSuccess === nextProps.onSubmitSuccess
  );
});
