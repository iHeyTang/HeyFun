// 识别文件类型
export function identifyFileTypeFromBuffer(buffer: Buffer): string {
  // 检查文件魔数（文件头）来识别文件类型
  const header = buffer.subarray(0, 16);

  // 图片格式
  if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg';
  }
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (
    header.subarray(0, 6).equals(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) ||
    header.subarray(0, 6).equals(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))
  ) {
    return 'image/gif';
  }
  if (header.subarray(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) && header.subarray(8, 12).equals(Buffer.from([0x57, 0x45, 0x42, 0x50]))) {
    return 'image/webp';
  }

  // 视频格式
  if (header.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x00, 0x18])) && header.subarray(4, 8).equals(Buffer.from([0x66, 0x74, 0x79, 0x70]))) {
    return 'video/mp4';
  }
  if (header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return 'video/webm';
  }
  if (header.subarray(0, 3).equals(Buffer.from([0x00, 0x00, 0x01, 0xb3]))) {
    return 'video/mpeg';
  }

  // 音频格式
  if (header.subarray(0, 3).equals(Buffer.from([0x49, 0x44, 0x33]))) {
    return 'audio/mpeg';
  }
  if (header.subarray(0, 4).equals(Buffer.from([0x4f, 0x67, 0x67, 0x53]))) {
    return 'audio/ogg';
  }
  if (header.subarray(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) && header.subarray(8, 12).equals(Buffer.from([0x57, 0x41, 0x56, 0x45]))) {
    return 'audio/wav';
  }
  // 默认返回通用二进制类型
  return 'application/octet-stream';
}

// 根据文件类型获取文件扩展名
export function getFileExtension(fileType: string): string {
  switch (fileType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    case 'image/svg+xml':
      return '.svg';
    case 'video/mp4':
      return '.mp4';
    case 'video/webm':
      return '.webm';
    case 'video/mpeg':
      return '.mpeg';
    case 'video/quicktime':
      return '.mov';
    case 'video/x-msvideo':
      return '.avi';
    case 'audio/mpeg':
      return '.mp3';
    case 'audio/ogg':
      return '.ogg';
    case 'audio/wav':
      return '.wav';
    case 'audio/aac':
      return '.aac';
    case 'application/pdf':
      return '.pdf';
    case 'application/zip':
      return '.zip';
    case 'application/x-tar':
      return '.tar';
    case 'application/gzip':
      return '.gz';
    case 'text/plain':
      return '.txt';
    case 'application/json':
      return '.json';
    case 'text/csv':
      return '.csv';
    default:
      return '.bin';
  }
}

export const isVideoExtension = (filename: string): boolean => {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.webm', '.mpeg'];
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

export const isImageExtension = (filename: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

export const isAudioExtension = (filename: string): boolean => {
  const audioExtensions = ['.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac', '.wma'];
  return audioExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};
