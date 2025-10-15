'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Clock } from 'lucide-react';
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

  // 格式化时间
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card
      className="group bg-card relative cursor-pointer overflow-hidden border-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
      onClick={() => window.open(`/dashboard/flowcanvas/${project.id}`, '_blank')}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-card-foreground group-hover:text-card-foreground/80 truncate text-lg font-semibold transition-colors">
              {project.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
      </CardHeader>

      <CardContent className="pt-0">
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          <span>
            {t('updatedAt')} {formatTime(project.updatedAt)}
          </span>
        </div>
      </CardContent>

      {/* 悬停时的渐变覆盖层 */}
      <div className="to-muted/20 pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </Card>
  );
}
