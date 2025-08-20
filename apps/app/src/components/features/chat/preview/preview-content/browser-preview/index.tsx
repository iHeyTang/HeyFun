import { Badge } from '@/components/ui/badge';
import { getImageUrl } from '@/lib/browser/image';
import { GlobeIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface BrowserPreviewProps {
  url: string;
  title: string;
  screenshot: string;
}

export const BrowserPreview = ({ url, title, screenshot }: BrowserPreviewProps) => {
  return (
    <div className="h-full w-full overflow-hidden">
      <Link href={url} target="_blank" rel="noopener noreferrer" className="mb-2 block w-fit max-w-full">
        <Badge className="max-w-full cursor-pointer font-mono text-xs">
          <div className="flex items-center justify-start gap-1 overflow-hidden">
            <GlobeIcon className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">{title}</span>
          </div>
        </Badge>
      </Link>
      <div className="h-full rounded-2xl border p-1">
        <div className="h-full w-full overflow-auto rounded-2xl">
          <Image
            src={getImageUrl(screenshot)}
            alt="FunMax's Computer Screen"
            width={1920}
            height={1080}
            className="h-auto w-full"
            sizes="(max-width: 1920px) 100vw, 1920px"
            priority
          />
        </div>
      </div>
    </div>
  );
};
