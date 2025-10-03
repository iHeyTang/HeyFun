'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { CloneTasks } from './components/CloneTasks';
import { VoiceCloneDialog, VoiceCloneDialogRef } from './components/VoiceCloneDialog';
import { VoicesList } from './components/VoicesList';

export default function VoicesPage() {
  const t = useTranslations('voices');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const cloneDialogRef = useRef<VoiceCloneDialogRef>(null);

  const handleCloneVoiceSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleOpenCloneDialog = () => {
    cloneDialogRef.current?.open();
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="voices" className="flex flex-1 flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="voices">{t('tabs.voices')}</TabsTrigger>
          <TabsTrigger value="clone">{t('tabs.cloneTasks')}</TabsTrigger>
        </TabsList>

        {/* 音色列表 */}
        <TabsContent value="voices" className="flex-1 overflow-y-auto">
          <VoicesList onCloneClick={handleOpenCloneDialog} refreshTrigger={refreshTrigger} />
        </TabsContent>

        {/* 克隆任务列表 */}
        <TabsContent value="clone" className="flex-1 overflow-y-auto">
          <CloneTasks refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>

      {/* 克隆音色对话框 */}
      <VoiceCloneDialog ref={cloneDialogRef} onSuccess={handleCloneVoiceSuccess} />

      {/* 同步音色对话框 */}
    </div>
  );
}
