import { getAigcProviderConfigs, getAigcProviders } from '@/actions/aigc';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Palette } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function AigcProviderSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [providerInfos, setProviderInfos] = useState<{ provider: string; displayName: string }[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<{ id: string; provider: string }[]>([]);

  useEffect(() => {
    getAigcProviders({}).then(p => {
      if (!p.data) {
        return;
      }
      setProviderInfos(p.data);
    });
  }, []);

  useEffect(() => {
    getAigcProviderConfigs({}).then(p => {
      if (!p.data) {
        return;
      }
      setProviderConfigs(p.data);
    });
  }, []);

  return (
    <div className="bg-muted/20 flex h-full w-[240px] flex-col shadow">
      <ScrollArea className="flex-1 py-4">
        <div className="space-y-1">
          {providerInfos.map(info => {
            const isSelected = pathname.startsWith(`/settings/aigc/${info.provider}`);

            return (
              <div
                key={info.provider}
                className={`flex cursor-pointer items-center justify-between p-2 px-4 transition-colors ${
                  isSelected ? 'bg-accent' : 'hover:bg-accent'
                }`}
                onClick={() => router.push(`/settings/aigc/${info.provider}`)}
              >
                <div className="flex items-center gap-2">
                  <Palette className="h-3 w-3" />
                  <span className="text-sm">{info.displayName}</span>
                </div>
                <Badge className="text-xs" variant="secondary">
                  {providerConfigs.filter(config => config.provider === info.provider).length}
                </Badge>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
