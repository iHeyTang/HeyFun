'use client';

import { getAigcProviderInfo, getAigcProviderModels } from '@/actions/aigc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ServiceModel } from '@repo/llm/aigc';
import { Globe, Search, Settings } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AigcProviderDetailsPanel({ params }: { params: Promise<{ providerId: string }> }) {
  const [providerInfo, setProviderInfo] = useState<Awaited<ReturnType<typeof getAigcProviderInfo>>['data']>();
  const [models, setModels] = useState<ServiceModel[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    params.then(params => {
      getAigcProviderInfo({ provider: params.providerId }).then(p => {
        if (p.data) {
          setProviderInfo(p.data);
        }
      });

      getAigcProviderModels({ provider: params.providerId }).then(p => {
        if (!p.data) {
          return;
        }
        setModels(p.data);
      });
    });
  }, [params]);

  // Filter models based on search term
  const filteredModels = models.filter(
    model =>
      model.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (model.description && model.description.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  if (!providerInfo) {
    return <div />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Title bar */}
      <div className="flex-shrink-0 p-6">
        <div className="flex items-baseline gap-4">
          <div className="flex flex-1 items-center">
            <h2 className="text-2xl leading-none font-bold">{providerInfo.displayName}</h2>
          </div>
          <Link href={`/dashboard/settings/aigc/${providerInfo.provider}/config`}>
            <Button variant="ghost" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              配置提供商
            </Button>
          </Link>
        </div>
        <div className="mt-2">
          <Link href={providerInfo.homepage} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block" title="Homepage">
            <Badge className="rounded-lg border-none bg-blue-100 px-3 py-1 font-light text-blue-700 shadow-none backdrop-blur-sm" variant="secondary">
              <Globe className="h-5 w-5" /> {providerInfo.homepage}
            </Badge>
          </Link>
        </div>
        <div className="text-muted-foreground mt-2 text-sm">{providerInfo.description}</div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-6 pr-4">
        {/* Model list */}
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
          <div className="flex flex-shrink-0 items-center justify-between pr-3">
            <h3 className="text-lg font-semibold">支持的模型</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input placeholder="搜索模型..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-64 pl-9" />
              </div>
              <Badge variant="secondary">{filteredModels.length} 个模型</Badge>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-3">
            {filteredModels.map((model, index) => {
              return (
                <div key={`${model.service}-${model.model}-${index}`} className="bg-silver-gradient rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="font-medium">{model.model}</h4>
                        {model.parameterLimits?.generationType?.map(type => (
                          <Badge variant="secondary" className="text-xs" key={type}>
                            {type}
                          </Badge>
                        ))}
                      </div>
                      <Badge variant="secondary" className="flex flex-wrap gap-6 text-xs">
                        {model.parameterLimits?.aspectRatio ? (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-muted-foreground">Aspect Ratio:</span>
                            {model.parameterLimits?.aspectRatio?.map(ratio => (
                              <div className="text-xs" key={ratio}>
                                {ratio}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {model.parameterLimits?.duration ? (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-muted-foreground">Duration:</span>
                            {model.parameterLimits?.duration?.map(duration => (
                              <div className="text-xs" key={duration}>
                                {duration}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </Badge>
                      {model.description && (
                        <div className="mt-2 ml-1">
                          <p className="text-muted-foreground text-xs">{model.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
