import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLLM } from '@/hooks/use-llm';
import { Settings, Stars, Wand2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export function ProviderSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const { providerInfos, providerConfigs } = useLLM();

  return (
    <div className="bg-muted/20 flex h-full w-[240px] flex-col shadow">
      <ScrollArea className="flex-1 py-4">
        <div className="space-y-1">
          {providerInfos?.map(info => {
            const isSelected = pathname.startsWith(`/dashboard/settings/llm/${info.provider}`);

            return (
              <div
                key={info.provider}
                className={`flex cursor-pointer items-center justify-between p-2 px-4 transition-colors ${
                  isSelected ? 'bg-accent' : 'hover:bg-accent'
                }`}
                onClick={() => router.push(`/dashboard/settings/llm/${info.provider}`)}
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-3 w-3" />
                  <span className="text-sm">{info.displayName}</span>
                </div>
                {info.provider === 'builtin' ? (
                  <Badge className="text-xs" variant="secondary">
                    <Stars />
                  </Badge>
                ) : (
                  providerConfigs?.find(config => config.provider === info.provider)?.id && (
                    <Badge className="text-xs" variant="secondary">
                      <Wand2 />
                    </Badge>
                  )
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
