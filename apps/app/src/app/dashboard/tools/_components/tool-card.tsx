'use client';

import { ToolSchemas } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Download, Star, Tag } from 'lucide-react';

interface ToolCardProps {
  tool: ToolSchemas;
  installed: boolean;
  onShowInfo: () => void;
  t: any;
}

export function ToolCard({ tool, installed, onShowInfo, t }: ToolCardProps) {
  const tags = Array.isArray(tool.tags) ? tool.tags.filter((tag): tag is string => typeof tag === 'string') : [];

  return (
    <div
      onClick={onShowInfo}
      className={cn(
        'group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-200',
        'hover:border-border-secondary hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      {/* Header with logo and status */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {tool.logoUrl ? (
            <div className="relative overflow-hidden rounded-lg border border-border/50 bg-muted/50 p-1.5">
              <img
                src={tool.logoUrl}
                alt={`${tool.name} logo`}
                className="h-10 w-10 rounded-md object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="from-primary/20 to-primary/5 flex h-12 w-12 items-center justify-center rounded-lg border border-border/50 bg-gradient-to-br text-sm font-semibold text-primary shadow-sm">
              {tool.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground line-clamp-1 text-sm font-semibold leading-tight">{tool.name}</h3>
              {tool.author && (
                <p className="text-muted-foreground mt-1 text-xs leading-tight">
                  {t('item.by')} <span className="font-medium">{tool.author}</span>
                </p>
              )}
            </div>
            {installed && (
              <Badge
                variant="secondary"
                className="bg-badge-green/10 text-badge-green border-badge-green/20 shrink-0 border text-xs font-medium"
              >
                {t('badge.installed')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {tool.description && (
        <p className="text-muted-foreground line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed">{tool.description}</p>
      )}

      {/* Footer stats */}
      <div className="border-border/50 flex items-center gap-2 border-t pt-3">
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          {tool.stars && (
            <Badge
              variant="outline"
              className="bg-badge-amber/10 text-badge-amber border-badge-amber/20 flex shrink-0 items-center gap-1 border px-2 py-0.5 text-[11px] font-medium"
            >
              <Star className="h-3 w-3" />
              {tool.stars > 1000 ? `${(tool.stars / 1000).toFixed(1)}k` : tool.stars}
            </Badge>
          )}
          {tool.downloads && (
            <Badge
              variant="outline"
              className="bg-badge-blue/10 text-badge-blue border-badge-blue/20 flex shrink-0 items-center gap-1 border px-2 py-0.5 text-[11px] font-medium"
            >
              <Download className="h-3 w-3" />
              {tool.downloads > 1000 ? `${(tool.downloads / 1000).toFixed(1)}k` : tool.downloads}
            </Badge>
          )}
          {tool.version && (
            <Badge
              variant="outline"
              className="bg-muted/50 text-muted-foreground border-border/50 shrink-0 border px-2 py-0.5 text-[11px] font-medium"
            >
              v{tool.version}
            </Badge>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5">
            {tags.slice(0, 2).map((tag: string, index: number) => (
              <Badge
                key={index}
                variant="outline"
                className="bg-secondary/50 text-muted-foreground border-border/50 inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-medium"
              >
                <Tag className="h-3 w-3" />
                <span className="truncate max-w-[60px]">{tag}</span>
              </Badge>
            ))}
            {tags.length > 2 && (
              <span className="text-muted-foreground text-[11px] font-medium">+{tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
