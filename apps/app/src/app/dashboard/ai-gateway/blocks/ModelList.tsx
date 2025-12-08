'use client';

import { getModelList } from '@/actions/gateway';
import { ModelCard } from '@/components/features/model-card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ModelInfo } from '@repo/llm/chat';
import { Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { union } from 'lodash';

interface ModelListProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
}

export function ModelList({ refreshTrigger, onRefresh }: ModelListProps) {
  const t = useTranslations('gateway');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelSearchKeywords, setModelSearchKeywords] = useState<string[]>([]);

  useEffect(() => {
    loadConfigs();
  }, [refreshTrigger]);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const result = await getModelList({});
      if (result.data) {
        setModels(result.data);
      } else {
        toast.error(result.error || t('toast.loadConfigsFailed'));
      }
    } catch (error) {
      toast.error(t('toast.loadConfigsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // 当前的所有模型类型/能力支持
  const modelTypes = useMemo(() => {
    const map = {
      language: { label: '对话模型', color: 'purple' },
      embedding: { label: '向量模型', color: 'blue' },
      image: { label: '图像模型', color: 'green' },
    };

    const supportsMap = {
      vision: { label: '视觉识别', color: 'green' },
      function: { label: '函数调用', color: 'yellow' },
    };

    const types = union(models.map(model => model.type))
      .filter(type => type !== undefined && type !== null && type !== ('' as 'language' | 'embedding' | 'image'))
      .map(type => ({
        value: `type:${type}`,
        label: map[type as 'language' | 'embedding' | 'image']?.label,
        color: map[type as 'language' | 'embedding' | 'image']?.color,
      }));

    const supportsList: string[] = [];
    models.forEach(model => {
      if (model.supportsVision) {
        supportsList.push('vision');
      }
      if (model.supportsFunctionCalling) {
        supportsList.push('function');
      }
    });
    const supports = union(supportsList)
      .filter(support => support !== undefined && support !== null && support !== ('' as 'vision' | 'function'))
      .map(support => ({
        value: `support:${support}`,
        label: supportsMap[support as 'vision' | 'function']?.label,
        color: supportsMap[support as 'vision' | 'function']?.color,
      }));

    return [...types, ...supports];
  }, [models]);

  // 过滤模型列表（本地搜索）
  const filteredModels = useMemo(() => {
    const query = modelSearchQuery.trim().toLowerCase();
    return models.filter(model => {
      const matchSearch =
        model.name.toLowerCase().includes(query) ||
        model.id.toLowerCase().includes(query) ||
        (model.description && model.description.toLowerCase().includes(query));

      const type = modelSearchKeywords.filter(keyword => keyword.startsWith('type:'));
      const matchType = type.length === 1 ? type.includes(`type:${model.type}`) : type.length === 0 ? true : false;

      const supportVision = modelSearchKeywords.find(keyword => keyword === 'support:vision');
      const matchSupportVision = supportVision ? model.supportsVision : true;
      const supportFunction = modelSearchKeywords.find(keyword => keyword === 'support:function');
      const matchSupportFunction = supportFunction ? model.supportsFunctionCalling : true;
      return matchSearch && matchType && matchSupportVision && matchSupportFunction;
    });
  }, [models, modelSearchQuery, modelSearchKeywords]);

  return (
    <div className="space-y-5">
      {/* 搜索框 */}
      {!isLoading && models.length > 0 && (
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="搜索模型..."
            value={modelSearchQuery}
            onChange={e => setModelSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      )}

      {/* Tag 快速选择 */}
      {!isLoading && models.length > 0 && modelTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {modelTypes
            .filter(type => type.value.startsWith('type:'))
            .map(type => (
              <Badge
                key={type.value}
                variant={modelSearchKeywords.includes(type.value) ? 'default' : 'outline'}
                className="cursor-pointer text-xs font-normal"
                onClick={() =>
                  setModelSearchKeywords(prev => {
                    if (prev.includes(type.value)) {
                      return prev.filter(keyword => keyword !== type.value);
                    }
                    const newKeywords = prev.filter(keyword => !keyword.startsWith('type:'));
                    return [...newKeywords, type.value];
                  })
                }
              >
                {type.label}
              </Badge>
            ))}
          {modelTypes
            .filter(type => type.value.startsWith('support:'))
            .map(type => (
              <Badge
                key={type.value}
                variant={modelSearchKeywords.includes(type.value) ? 'default' : 'outline'}
                className="cursor-pointer text-xs font-normal"
                onClick={() =>
                  setModelSearchKeywords(
                    modelSearchKeywords.includes(type.value)
                      ? modelSearchKeywords.filter(keyword => keyword !== type.value)
                      : [...modelSearchKeywords, type.value],
                  )
                }
              >
                {type.label}
              </Badge>
            ))}
        </div>
      )}

      {/* Models List */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(500px,1fr))] gap-3">
        {filteredModels.map(model => (
          <ModelCard key={model.id} model={model} className="bg-muted/30 hover:bg-muted" />
        ))}
      </div>

      {filteredModels.length === 0 && !isLoading && (
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-muted-foreground text-[13px]">{t('emptyState.configs')}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
