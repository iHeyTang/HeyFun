import { NodeTypes } from '@xyflow/react';
import ImageNode from './ImageNode';
import VideoNode from './VideoNode';
import TextNode from './TextNode';

export { ImageNode, VideoNode, TextNode };

export const nodeTypes: NodeTypes = {
  image: ImageNode,
  video: VideoNode,
  text: TextNode,
};
