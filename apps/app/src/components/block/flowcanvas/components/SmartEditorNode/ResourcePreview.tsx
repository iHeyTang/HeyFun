import React from 'react';
import { MentionItem } from './MentionList';

interface ResourcePreviewProps {
  item: MentionItem;
}

export const ResourcePreview: React.FC<ResourcePreviewProps> = ({ item }) => {
  switch (item.type) {
    case 'image':
      return (
        <div className="max-w-48 overflow-hidden rounded-md">
          <img src={item.imageUrl} alt={item.imageAlt || item.id} className="aspect-auto h-full w-full object-contain" />
        </div>
      );
    case 'video':
      return (
        <div className="relative max-w-48 overflow-hidden rounded-md bg-black">
          <video src={item.videoUrl} className="aspect-auto h-full w-full object-cover" />
        </div>
      );
    default:
      return null;
  }
};
