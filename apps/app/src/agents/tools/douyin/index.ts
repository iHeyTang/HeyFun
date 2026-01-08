/**
 * 抖音工具集合
 * 提供抖音视频信息获取、下载等功能
 */

import { douyinGetVideoInfoTool } from './get-video-info';
import { douyinDownloadVideoTool } from './download-video';

export * from './get-video-info';
export * from './download-video';

export const douyinToolboxes = [douyinGetVideoInfoTool, douyinDownloadVideoTool];
