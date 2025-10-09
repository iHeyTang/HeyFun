'use client';

import { getAigcModels } from '@/actions/llm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GenerationType } from '@repo/llm/aigc';
import { Image, Mic, Search, Sparkles, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

type ModelInfo = NonNullable<Awaited<ReturnType<typeof getAigcModels>>['data']>[number];

interface ModelSelectorProps {
  models: ModelInfo[];
  selectedModel?: string;
  onModelSelect: (modelName: string) => void;
  placeholder?: string;
}

// 生成类型图标映射
const generationTypeIcons = {
  'text-to-image': Image,
  'image-to-image': Image,
  'text-to-video': Video,
  'image-to-video': Video,
  'keyframe-to-video': Video,
  'text-to-speech': Mic,
};

export function AigcModelSelector({ models, selectedModel, onModelSelect, placeholder }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const t = useTranslations('common.aigcModelSelector');
  const tTypes = useTranslations('common.aigcModelSelector.generationTypes');
  const tCategories = useTranslations('common.aigcModelSelector.categories');

  // 生成类型名称映射
  const generationTypeNames = {
    'text-to-image': tTypes('textToImage'),
    'image-to-image': tTypes('imageToImage'),
    'text-to-video': tTypes('textToVideo'),
    'image-to-video': tTypes('imageToVideo'),
    'keyframe-to-video': tTypes('keyframeToVideo'),
    'text-to-speech': tTypes('textToSpeech'),
  };

  // 分类配置
  const categories = [
    { key: 'all', label: tCategories('all'), icon: Sparkles },
    { key: 'text-to-image', label: tCategories('textToImage'), icon: Image },
    { key: 'image-to-image', label: tCategories('imageToImage'), icon: Image },
    { key: 'video', label: tCategories('video'), icon: Video },
    { key: 'speech', label: tCategories('speech'), icon: Mic },
  ];

  const selectedModelInfo = useMemo(() => {
    return models.find(model => model.name === selectedModel);
  }, [models, selectedModel]);

  // 过滤和分类模型
  const filteredModels = useMemo(() => {
    let filtered = models;

    // 按搜索关键词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        model =>
          model.displayName.toLowerCase().includes(query) ||
          model.description?.toLowerCase().includes(query) ||
          model.generationTypes.some(type => generationTypeNames[type as keyof typeof generationTypeNames]?.toLowerCase().includes(query)),
      );
    }

    // 按分类过滤
    if (activeCategory !== 'all') {
      if (activeCategory === 'video') {
        filtered = filtered.filter(model =>
          model.generationTypes.some(type => ['text-to-video', 'image-to-video', 'keyframe-to-video'].includes(type)),
        );
      } else if (activeCategory === 'speech') {
        filtered = filtered.filter(model => model.generationTypes.some(type => ['text-to-speech'].includes(type)));
      } else {
        filtered = filtered.filter(model => model.generationTypes.includes(activeCategory as GenerationType));
      }
    }

    return filtered;
  }, [models, searchQuery, activeCategory]);

  const handleModelSelect = (modelName: string) => {
    onModelSelect(modelName);
    setIsOpen(false);
    setSearchQuery('');
    setActiveCategory('all');
  };

  return (
    <div className="flex flex-col space-y-1">
      <label className="text-sm font-medium">{t('model')}</label>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="h-auto w-full justify-start p-4 shadow-none" onClick={() => setIsOpen(true)}>
            <div className="flex w-full flex-col items-start space-y-2">
              {selectedModelInfo ? (
                <>
                  <span className="font-medium">{selectedModelInfo.displayName}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
          </Button>
        </DialogTrigger>

        <DialogContent style={{ maxWidth: '80vw' }}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input placeholder={t('searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>

            {/* 分类标签页 */}
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="grid w-full grid-cols-5">
                {categories.map(category => {
                  const Icon = category.icon;
                  return (
                    <TabsTrigger key={category.key} value={category.key} className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <span>{category.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value={activeCategory} className="mt-4">
                <ScrollArea className="h-[60vh]">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,320px))] gap-4">
                    {filteredModels.map(model => (
                      <Card
                        key={model.name}
                        className={`h-48 cursor-pointer overflow-hidden shadow-none transition-all hover:shadow-md ${selectedModel === model.name ? 'border-primary border-2' : ''}`}
                        onClick={() => handleModelSelect(model.name)}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{model.displayName}</CardTitle>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {model.generationTypes.map(type => {
                              const Icon = generationTypeIcons[type as keyof typeof generationTypeIcons];
                              return (
                                <Badge key={type} variant="secondary" className="text-xs">
                                  {Icon ? <Icon className="text-muted-foreground h-4 w-4" /> : null}
                                  {generationTypeNames[type as keyof typeof generationTypeNames] || type}
                                </Badge>
                              );
                            })}
                          </div>
                          {model.costDescription && (
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="text-muted-foreground h-4 w-4" />
                              {model.costDescription}
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent className="overflow-hidden">
                          {model.description && <CardDescription className="line-clamp-2 text-sm">{model.description}</CardDescription>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {filteredModels.length === 0 && (
                    <div className="text-muted-foreground py-8 text-center">{searchQuery ? t('noMatch') : t('noModels')}</div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
