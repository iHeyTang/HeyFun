'use client';

import { Button } from '@/components/ui/button';
import { formatTimeFromNow } from '@/lib/shared/time';
import { cn } from '@/lib/utils';
import { Trash2, Clock, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FlowCanvasProject {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  schema: any;
}

interface ProjectCardProps {
  project: FlowCanvasProject;
  onDelete: (projectId: string, projectName: string) => void;
}

export default function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const t = useTranslations('flowcanvas.project');

  return (
    <div
      onClick={() => window.open(`/dashboard/flowcanvas/${project.id}`, '_blank')}
      className={cn('bg-muted/30 hover:bg-muted group relative w-full cursor-pointer select-none rounded-lg px-4 py-3 text-left transition-all')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* 项目名称 */}
            <div className="items-baseline gap-2">
              <div className="text-foreground text-[14px] font-medium">{project.name}</div>
            </div>

            {/* 更新时间 */}
            <div className="text-muted-foreground flex items-center text-[11px]">
              <Clock className="mr-1 h-3 w-3" />
              <span>
                {t('updatedAt')} {formatTimeFromNow(project.updatedAt.getTime())}
              </span>
            </div>
          </div>
        </div>

        {/* 删除按钮 */}
        <div className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
            onClick={e => {
              e.stopPropagation();
              onDelete(project.id, project.name);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
