import { NodeTypes } from '@xyflow/react';
import ImageNode from './ImageNode';
import VideoNode from './VideoNode';
import AudioNode from './AudioNode';
import TextNode from './TextNode';

export { ImageNode, VideoNode, AudioNode, TextNode };

export const nodeTypes: NodeTypes = {
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  text: TextNode,
};
