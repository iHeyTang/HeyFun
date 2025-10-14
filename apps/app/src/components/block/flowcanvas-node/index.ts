import { NodeTypes } from '@xyflow/react';
import ImageNode from './ImageNode';
import VideoNode from './VideoNode';
import AudioNode from './AudioNode';
import MusicNode from './MusicNode';
import TextNode from './TextNode';

export { ImageNode, VideoNode, AudioNode, MusicNode, TextNode };

export const nodeTypes: NodeTypes = {
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  music: MusicNode,
  text: TextNode,
};
