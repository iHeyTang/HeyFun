// 自定义矩形图标组件，根据比例动态调整宽高
export const RatioIcon = ({ ratio }: { ratio: string }) => {
  // 解析比例字符串，如 "16:9", "1:1", "4:3" 等
  const parseRatio = (ratioStr: string) => {
    const parts = ratioStr.split(':');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const width = parseFloat(parts[0]);
      const height = parseFloat(parts[1]);
      return { width, height };
    }
    return { width: 1, height: 1 }; // 默认正方形
  };

  const { width, height } = parseRatio(ratio);

  // 计算显示尺寸，保持最大尺寸为16px
  const maxSize = 24;
  const aspectRatio = width / height;

  let displayWidth = maxSize;
  let displayHeight = maxSize;

  if (aspectRatio > 1) {
    // 宽大于高
    displayHeight = maxSize / aspectRatio;
  } else if (aspectRatio < 1) {
    // 高大于宽
    displayWidth = maxSize * aspectRatio;
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center">
      <div
        className="rounded-[4px] border-2 border-current/80"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
        }}
      />
    </div>
  );
};
