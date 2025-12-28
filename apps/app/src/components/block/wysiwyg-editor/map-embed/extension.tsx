'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { MapEmbed } from './component';

/**
 * 地图 NodeView 组件
 */
const MapEmbedNodeView = ({ node }: any) => {
  const attrs = node.attrs;

  return (
    <NodeViewWrapper as="div" className="map-embed-wrapper">
      <MapEmbed
        location={attrs.location}
        name={attrs.name}
        zoom={attrs.zoom}
        width={attrs.width}
        height={attrs.height}
        data-from-location={attrs['data-from-location']}
        data-from-name={attrs['data-from-name']}
        data-to-location={attrs['data-to-location']}
        data-to-name={attrs['data-to-name']}
        data-route-type={attrs['data-route-type']}
        data-policy={attrs['data-policy']}
        data-route-data={attrs['data-route-data']}
      />
    </NodeViewWrapper>
  );
};

/**
 * 创建地图嵌入扩展
 */
export const MapEmbedExtension = Node.create({
  name: 'mapEmbed',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      location: {
        default: null,
        parseHTML: element => element.getAttribute('location'),
        renderHTML: attributes => {
          if (!attributes.location) {
            return {};
          }
          return {
            location: attributes.location,
          };
        },
      },
      name: {
        default: null,
        parseHTML: element => element.getAttribute('name'),
        renderHTML: attributes => {
          if (!attributes.name) {
            return {};
          }
          return {
            name: attributes.name,
          };
        },
      },
      zoom: {
        default: 14,
        parseHTML: element => {
          const zoom = element.getAttribute('zoom');
          return zoom ? parseInt(zoom, 10) : 14;
        },
        renderHTML: attributes => {
          return {
            zoom: String(attributes.zoom || 14),
          };
        },
      },
      width: {
        default: 600,
        parseHTML: element => {
          const width = element.getAttribute('width');
          return width ? parseInt(width, 10) : 600;
        },
        renderHTML: attributes => {
          return {
            width: String(attributes.width || 600),
          };
        },
      },
      height: {
        default: 400,
        parseHTML: element => {
          const height = element.getAttribute('height');
          return height ? parseInt(height, 10) : 400;
        },
        renderHTML: attributes => {
          return {
            height: String(attributes.height || 400),
          };
        },
      },
      // 路径规划相关属性
      'data-from-location': {
        default: null,
        parseHTML: element => element.getAttribute('data-from-location'),
        renderHTML: attributes => {
          if (!attributes['data-from-location']) {
            return {};
          }
          return {
            'data-from-location': attributes['data-from-location'],
          };
        },
      },
      'data-from-name': {
        default: null,
        parseHTML: element => element.getAttribute('data-from-name'),
        renderHTML: attributes => {
          if (!attributes['data-from-name']) {
            return {};
          }
          return {
            'data-from-name': attributes['data-from-name'],
          };
        },
      },
      'data-to-location': {
        default: null,
        parseHTML: element => element.getAttribute('data-to-location'),
        renderHTML: attributes => {
          if (!attributes['data-to-location']) {
            return {};
          }
          return {
            'data-to-location': attributes['data-to-location'],
          };
        },
      },
      'data-to-name': {
        default: null,
        parseHTML: element => element.getAttribute('data-to-name'),
        renderHTML: attributes => {
          if (!attributes['data-to-name']) {
            return {};
          }
          return {
            'data-to-name': attributes['data-to-name'],
          };
        },
      },
      'data-route-type': {
        default: null,
        parseHTML: element => element.getAttribute('data-route-type'),
        renderHTML: attributes => {
          if (!attributes['data-route-type']) {
            return {};
          }
          return {
            'data-route-type': attributes['data-route-type'],
          };
        },
      },
      'data-policy': {
        default: null,
        parseHTML: element => element.getAttribute('data-policy'),
        renderHTML: attributes => {
          if (!attributes['data-policy']) {
            return {};
          }
          return {
            'data-policy': attributes['data-policy'],
          };
        },
      },
      'data-route-data': {
        default: null,
        parseHTML: element => element.getAttribute('data-route-data'),
        renderHTML: attributes => {
          if (!attributes['data-route-data']) {
            return {};
          }
          return {
            'data-route-data': attributes['data-route-data'],
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'map-embed',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['map-embed', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MapEmbedNodeView);
  },
});
