'use client';

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import React, { useState } from 'react';

interface MediaPreviewProps {
  src: string;
  alt: string;
  type: 'image' | 'video';
  filename: string;
  onDownload?: () => void;
  children: React.ReactNode;
}

export function MediaPreview({ src, alt, type, filename, onDownload, children }: MediaPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTitle className="sr-only">{filename}</DialogTitle>
      <DialogTrigger asChild>
        <div className="cursor-pointer transition-opacity hover:opacity-80">{children}</div>
      </DialogTrigger>
      <DialogContent className="h-fit w-fit overflow-hidden p-0" style={{ maxWidth: '90vw', maxHeight: '90vh' }} showCloseButton={false}>
        <div className="relative flex flex-col">
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            {onDownload && (
              <Button variant="secondary" size="sm" onClick={onDownload} className="bg-black/50 text-white hover:bg-black/70">
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)} className="bg-black/50 text-white hover:bg-black/70">
              ✕
            </Button>
          </div>

          {type === 'image' ? <ImagePreview src={src} alt={alt} /> : <VideoPreview src={src} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ImagePreviewProps {
  src: string;
  alt: string;
}

function ImagePreview({ src, alt }: ImagePreviewProps) {
  return (
    <div className="flex max-h-[90vh] max-w-[90vw] items-center justify-center overflow-hidden bg-black">
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" draggable={false} />
    </div>
  );
}

interface VideoPreviewProps {
  src: string;
}

function VideoPreview({ src }: VideoPreviewProps) {
  return (
    <video src={src} controls className="max-h-full max-w-full object-contain" autoPlay={false}>
      Your browser does not support the video tag.
    </video>
  );
}
