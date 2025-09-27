'use client';

import { Button } from '@/components/ui/button';
import { ConfirmDialog, confirm } from '@/components/block/confirm';
import { createFlowCanvasProject, deleteFlowCanvasProject, getFlowCanvasProjects } from '@/actions/flowcanvas';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import EmptyState from './components/EmptyState';
import ProjectCard from './components/ProjectCard';

interface FlowCanvasProject {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  schema: any;
}

export default function FlowCanvasListPage() {
  const t = useTranslations('flowcanvas');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [projects, setProjects] = useState<FlowCanvasProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // 加载项目列表
  const loadProjects = async () => {
    try {
      setLoading(true);
      const result = await getFlowCanvasProjects({ page: 1, pageSize: 50 });
      console.log('result', result);
      if (result.data) {
        setProjects(result.data.projects);
      } else {
        throw new Error(result.error || t('toast.loadError'));
      }
    } catch (error) {
      console.error('加载项目失败:', error);
      toast.error(t('toast.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // 创建新项目
  const handleCreateProject = async () => {
    try {
      setIsCreating(true);
      const result = await createFlowCanvasProject({
        name: 'Untitled',
        schema: { nodes: [], edges: [] },
      });

      if (result.data) {
        toast.success(t('toast.createSuccess'));
        loadProjects();

        // 跳转到新创建的项目
        router.push(`/dashboard/flowcanvas/${result.data.id}`);
      } else {
        throw new Error(result.error || t('toast.createError'));
      }
    } catch (error: any) {
      console.error('创建项目失败:', error);
      toast.error(error.message || t('toast.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  // 删除项目
  const handleDeleteProject = async (projectId: string, projectName: string) => {
    confirm({
      content: t('confirmDelete', { name: projectName }),
      buttonText: {
        cancel: tCommon('cancel'),
        confirm: tCommon('delete'),
        loading: tCommon('deleting'),
      },
      onConfirm: async () => {
        try {
          const result = await deleteFlowCanvasProject({ projectId });
          if (result.error) {
            throw new Error(result.error);
          }
          toast.success(t('toast.deleteSuccess'));
          loadProjects();
        } catch (error: any) {
          console.error('删除项目失败:', error);
          toast.error(error.message || t('toast.deleteError'));
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{tCommon('loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          </div>

          <Button onClick={handleCreateProject} disabled={isCreating} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg">
            <Plus className="mr-2 h-4 w-4" />
            {isCreating ? tCommon('creating') : t('newProject')}
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState onCreateProject={handleCreateProject} isCreating={isCreating} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} onDelete={handleDeleteProject} />
          ))}
        </div>
      )}

      <ConfirmDialog />
    </div>
  );
}
