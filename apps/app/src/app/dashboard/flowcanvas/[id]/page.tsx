'use client';

import { getFlowCanvasProject, updateFlowCanvasProject } from '@/actions/flowcanvas';
import { CanvasSchema, FlowCanvas, FlowCanvasRef } from '@/components/block/flowcanvas';
import AudioNode, { AudioNodeProcessor } from '@/components/block/flowcanvas-node/AudioNode';
import ImageNode, { ImageNodeProcessor } from '@/components/block/flowcanvas-node/ImageNode';
import MusicNode, { MusicNodeProcessor } from '@/components/block/flowcanvas-node/MusicNode';
import TextNode, { TextNodeProcessor } from '@/components/block/flowcanvas-node/TextNode';
import VideoNode, { VideoNodeProcessor } from '@/components/block/flowcanvas-node/VideoNode';
import ToolbarMenuButton from '@/components/block/flowcanvas/components/ToolbarMenuButton';
import ToolbarPanel from '@/components/block/flowcanvas/components/ToolbarPanel';
import TooltipButton from '@/components/block/tooltip-button';
import { Button } from '@/components/ui/button';
import { useAigc } from '@/hooks/use-llm';
import { format } from 'date-fns';
import { FileDown, FileIcon, FileUp, LayoutGridIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const useProjectSchema = (ft: any) => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refreshSchema = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const result = await getFlowCanvasProject({ projectId: id });
      if (result.data) {
        setProject(result.data);
      } else {
        throw new Error(result.error || ft('errors.loadFailed'));
      }
    } catch (error) {
      console.error(ft('errors.loadFailed'), error);
    } finally {
      setLoading(false);
    }
  }, [id, ft]);

  const updateSchema = useCallback(
    async (newSchema: CanvasSchema) => {
      if (!id) return;

      try {
        const result = await updateFlowCanvasProject({
          projectId: id,
          schema: newSchema,
        });
        if (result.data) {
          setProject(result.data);
        } else {
          throw new Error(result.error || ft('errors.updateFailed'));
        }
      } catch (error) {
        console.error(ft('errors.updateFailed'), error);
        throw error;
      }
    },
    [id, ft],
  );

  const updateName = useCallback(
    async (newName: string) => {
      if (!id) return;

      try {
        const result = await updateFlowCanvasProject({
          projectId: id,
          name: newName,
        });
        if (result.data) {
          setProject(result.data);
        } else {
          throw new Error(result.error || ft('errors.updateNameFailed'));
        }
      } catch (error) {
        console.error(ft('errors.updateNameFailed'), error);
        throw error;
      }
    },
    [id, ft],
  );

  useEffect(() => {
    refreshSchema();
  }, [refreshSchema]);

  return {
    schema: project?.schema as CanvasSchema | undefined,
    refreshSchema,
    updateSchema,
    name: project?.name || '',
    updateName,
    updatedAt: project?.updatedAt,
    loading,
  };
};

const FlowCanvasPage = () => {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('common');
  const ft = useTranslations('flowcanvas.project');

  const canvasRef = useRef<FlowCanvasRef>(null);

  // 使用schema hook获取云端数据
  const { schema, refreshSchema, updateSchema, name, updateName, updatedAt, loading } = useProjectSchema(ft);
  const [isLocalChange, setIsLocalChange] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastUpdateTimeRef = useRef<number>(0);

  useEffect(() => {
    if (name) {
      document.title = `${name} | HeyFun`;
    }
  }, [name]);

  // 名称编辑相关状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  const nodeTypes = useMemo(() => {
    return {
      image: { component: ImageNode, processor: new ImageNodeProcessor() },
      video: { component: VideoNode, processor: new VideoNodeProcessor() },
      audio: { component: AudioNode, processor: new AudioNodeProcessor() },
      text: { component: TextNode, processor: new TextNodeProcessor() },
      music: { component: MusicNode, processor: new MusicNodeProcessor() },
    };
  }, []);

  const { initiate: initiateAigc } = useAigc();

  // 格式化更新时间
  const formatUpdateTime = useCallback(
    (updatedAt: string | Date | undefined) => {
      if (!updatedAt) return '';

      const date = new Date(updatedAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) {
        return t('time.justUpdated');
      } else if (diffMinutes < 60) {
        return t('time.minutesAgo', { count: diffMinutes });
      } else if (diffHours < 24) {
        return t('time.hoursAgo', { count: diffHours });
      } else if (diffDays < 7) {
        return t('time.daysAgo', { count: diffDays });
      } else {
        // 对于超过7天的情况，使用本地化的日期格式
        const locale = typeof window !== 'undefined' ? (navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US') : 'en-US';
        return date.toLocaleDateString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    },
    [t],
  );

  useEffect(() => {
    initiateAigc();
  }, [initiateAigc]);

  useEffect(() => {
    refreshSchema();
  }, [refreshSchema]);

  const handleSchemaChange = useCallback(
    async (newSchema: CanvasSchema) => {
      console.log('handleSchemaChange', newSchema);
      setIsLocalChange(true);
      setIsSyncing(true);

      // 节流更新：2000ms内只执行最后一次更新
      const now = Date.now();
      lastUpdateTimeRef.current = now;

      setTimeout(async () => {
        // 检查是否是最新的更新请求
        if (lastUpdateTimeRef.current === now) {
          try {
            await updateSchema(newSchema);
            setIsSyncing(false);
          } catch (error) {
            console.error(ft('errors.syncFailed'), error);
            setIsSyncing(false);
          } finally {
            setIsLocalChange(false);
          }
        }
      }, 2000); // 2000ms节流延迟
    },
    [updateSchema],
  );

  // 导出canvas数据为JSON文件并下载
  const handleExportCanvas = useCallback(() => {
    const canvasData = canvasRef.current?.exportCanvas();
    if (canvasData) {
      const blob = new Blob([canvasData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      link.download = `canvas-${name}-${format(now, 'yyyyMMdd-HHmmss')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [id, name]);

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
            console.log(ft('messages.dataImport'), schema);
            canvasRef.current?.importCanvas(JSON.stringify(schema));
            console.log(ft('messages.importSuccess'));
          } catch (error) {
            console.error(ft('errors.importFailed'), error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  // 一键整理布局
  const handleAutoLayout = useCallback(() => {
    canvasRef.current?.autoLayout('LR');
  }, []);

  // 运行工作流
  const handleRun = useCallback(async () => {
    try {
      const result = await canvasRef.current?.run();
      console.log('Workflow execution result:', result);
    } catch (error) {
      console.error('Workflow execution failed:', error);
    }
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
        console.error(ft('errors.updateNameFailed'), error);
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <FlowCanvas
        className="h-full w-full"
        initialSchema={schema}
        onSchemaChange={handleSchemaChange}
        ref={canvasRef}
        nodeTypes={nodeTypes}
        titleBox={
          <div className="flex items-center gap-3">
            {/* 名称展示和编辑组件 */}
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-9 rounded-md border border-gray-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    placeholder={ft('namePlaceholder')}
                  />
                  <Button size="sm" variant="outline" onClick={handleSaveName}>
                    {t('save')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEditName}>
                    {t('cancel')}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2" onClick={handleStartEditName}>
                    <span className="flex h-9 max-w-[200px] items-center truncate px-3 text-sm font-medium" title={name}>
                      {name || ft('unnamed')}
                    </span>
                  </div>
                  {isSyncing ? (
                    <span className="flex items-center gap-1 text-xs text-blue-500">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
                      {t('sync.syncing')}
                    </span>
                  ) : updatedAt ? (
                    <span className="text-muted-foreground text-xs">{formatUpdateTime(updatedAt)}</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        }
        toolbox={
          <ToolbarPanel>
            <TooltipButton
              icon={<LayoutGridIcon className="size-4" />}
              label={ft('autoLayout')}
              onClick={handleAutoLayout}
              side="right"
              sideOffset={8}
            />
            <ToolbarMenuButton
              icon={FileIcon}
              label={ft('file')}
              actions={[
                { icon: FileUp, label: ft('import'), onClick: handleImportCanvas },
                { icon: FileDown, label: ft('export'), onClick: handleExportCanvas },
              ]}
              side="right"
              sideOffset={8}
            />
          </ToolbarPanel>
        }
        // agentPanel={<AgentPanel canvasId={id} canvasRef={canvasRef} />}
      />
    </div>
  );
};

export default FlowCanvasPage;
