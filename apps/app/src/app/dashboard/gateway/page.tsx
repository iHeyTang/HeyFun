'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ApiKeysList } from './blocks/ApiKeysList';
import { UsageStats } from './blocks/UsageStats';
import { ModelList } from './blocks/ModelList';

export default function GatewayPage() {
  const t = useTranslations('gateway');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="models" className="flex flex-1 flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="models">{t('tabs.models')}</TabsTrigger>
          <TabsTrigger value="usage">{t('tabs.usage')}</TabsTrigger>
          <TabsTrigger value="keys">{t('tabs.apiKeys')}</TabsTrigger>
        </TabsList>

        {/* Model Configs */}
        <TabsContent value="models" className="flex-1 overflow-y-auto">
          <ModelList refreshTrigger={refreshTrigger} onRefresh={handleRefresh} />
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="keys" className="flex-1 overflow-y-auto">
          <ApiKeysList refreshTrigger={refreshTrigger} onRefresh={handleRefresh} />
        </TabsContent>

        {/* Usage Stats */}
        <TabsContent value="usage" className="flex-1 overflow-y-auto">
          <UsageStats refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
