'use client';

import { CanvasSchema, FlowCanvas, FlowCanvasRef } from '@/components/block/flowcanvas';
import ImageNode, { ImageNodeProcessor } from '@/components/block/flowcanvas-node/ImageNode';
import TextNode, { TextNodeProcessor } from '@/components/block/flowcanvas-node/TextNode';
import VideoNode, { VideoNodeProcessor } from '@/components/block/flowcanvas-node/VideoNode';
import { Button } from '@/components/ui/button';
import { useAigc, useLLM } from '@/hooks/use-llm';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const useProjectSchema = () => {
  const { id } = useParams<{ id: string }>();
  return {
    schema: undefined as CanvasSchema | undefined,
    refreshSchema: () => {},
    updateSchema: (newSchema: CanvasSchema) => {},
    name: '',
    updateName: (newName: string) => {},
  };
};

const FlowCanvasPage = () => {
  const { id } = useParams<{ id: string }>();

  const canvasRef = useRef<FlowCanvasRef>(null);

  // 使用schema hook获取云端数据
  const { schema, refreshSchema, updateSchema, name, updateName } = useProjectSchema();
  const [isLocalChange, setIsLocalChange] = useState(false);
  const lastUpdateTimeRef = useRef<number>(0);

  // 名称编辑相关状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  const nodeTypes = useMemo(() => {
    return {
      image: { component: ImageNode, processor: new ImageNodeProcessor() },
      video: { component: VideoNode, processor: new VideoNodeProcessor() },
      text: { component: TextNode, processor: new TextNodeProcessor() },
    };
  }, []);

  const { initiate } = useLLM();
  const { initiate: initiateAigc } = useAigc();

  useEffect(() => {
    initiate();
    initiateAigc();
  }, [initiate]);

  useEffect(() => {
    refreshSchema();
  }, [refreshSchema]);

  const handleSchemaChange = useCallback(async (newSchema: CanvasSchema) => {
    console.log('handleSchemaChange', newSchema);
  }, []);

  // 导出canvas数据为JSON文件并下载
  const handleExportCanvas = useCallback(() => {
    const canvasData = canvasRef.current?.exportCanvas();
    if (canvasData) {
      const blob = new Blob([canvasData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `canvas-${id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [id]);

  // 导入canvas数据从JSON文件
  const handleImportCanvas = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = event => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = e => {
          const content = e.target?.result as string;
          try {
            const json = JSON.parse(content);
            const schema = { nodes: json.nodes, edges: json.edges } as CanvasSchema;
            console.log('Canvas数据导入', schema);
            canvasRef.current?.importCanvas(JSON.stringify(schema));
            console.log('Canvas数据导入成功');
          } catch (error) {
            console.error('导入失败:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  // 名称编辑相关处理函数
  const handleStartEditName = useCallback(() => {
    setEditingName(name);
    setIsEditingName(true);
  }, [name]);

  const handleCancelEditName = useCallback(() => {
    setIsEditingName(false);
    setEditingName('');
  }, []);

  const handleSaveName = useCallback(async () => {
    if (editingName.trim() && editingName !== name) {
      try {
        await updateName(editingName.trim());
        setIsEditingName(false);
        setEditingName('');
      } catch (error) {
        console.error('更新名称失败:', error);
      }
    } else {
      handleCancelEditName();
    }
  }, [editingName, name, updateName, handleCancelEditName]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveName();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEditName();
      }
    },
    [handleSaveName, handleCancelEditName],
  );

  //   if (!schema) {
  //     return <div>加载中...</div>;
  //   }

  return (
    <div className="h-full w-full">
      <FlowCanvas
        className="h-full w-full"
        initialSchema={schema}
        onSchemaChange={handleSchemaChange}
        ref={canvasRef}
        nodeTypes={nodeTypes}
        toolbox={
          <div className="flex gap-2">
            {/* 名称展示和编辑组件 */}
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-9 rounded-md border border-gray-300 px-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    autoFocus
                    placeholder="输入模板名称"
                  />
                  <Button size="sm" variant="outline" onClick={handleSaveName}>
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEditName}>
                    取消
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2" onClick={handleStartEditName}>
                  <span className="flex h-9 max-w-[200px] items-center truncate px-3 text-sm font-medium" title={name}>
                    {name || '未命名模板'}
                  </span>
                </div>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
};

export default FlowCanvasPage;
