'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SubtitleData {
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  utterances?: Array<{
    start_time: number;
    end_time: number;
    text: string;
    words?: Array<{
      start_time: number;
      end_time: number;
      text: string;
    }>;
  }>;
  duration?: number;
}

interface SubtitlePlayerProps {
  data: SubtitleData;
  audioUrl?: string;
}

export function SubtitlePlayer({ data, audioUrl }: SubtitlePlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 将 utterances 转换为 segments（统一格式）
  const segments = useMemo(
    () =>
      data.segments ||
      data.utterances?.map(u => ({
        start: u.start_time / 1000, // 毫秒转秒
        end: u.end_time / 1000,
        text: u.text,
      })) ||
      [],
    [data.segments, data.utterances],
  );

  // 监听音频播放时间
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);

      // 找到当前应该高亮的字幕
      const index = segments.findIndex(seg => audio.currentTime >= seg.start && audio.currentTime <= seg.end);
      setActiveIndex(index);

      // 自动滚动到当前字幕
      if (index >= 0 && scrollRef.current) {
        const activeElement = scrollRef.current.children[index] as HTMLElement;
        if (activeElement) {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setActiveIndex(-1);
    });

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('play', () => setIsPlaying(true));
      audio.removeEventListener('pause', () => setIsPlaying(false));
      audio.removeEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
        setActiveIndex(-1);
      });
    };
  }, [segments]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleSegmentClick = (start: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = start;
      if (!isPlaying) {
        audio.play();
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      {/* 音频播放器（如果有音频） */}
      {audioUrl && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePlayPause} className="flex-shrink-0">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <audio ref={audioRef} src={audioUrl} className="hidden" />
          <div className="text-muted-foreground flex-1 text-sm">
            {formatTime(currentTime)} / {data.duration ? formatTime(data.duration) : '--:--'}
          </div>
        </div>
      )}

      {/* 完整文本 */}
      {data.text && (
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="mb-1 text-sm font-medium">完整文本：</div>
          <div className="text-sm">{data.text}</div>
        </div>
      )}

      {/* 字幕列表 */}
      {segments.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">时间轴字幕：</div>
          <ScrollArea className="h-64 rounded-lg border p-2" ref={scrollRef}>
            <div className="space-y-2">
              {segments.map((segment, index) => (
                <div
                  key={index}
                  onClick={() => handleSegmentClick(segment.start)}
                  className={`cursor-pointer rounded-lg p-2 transition-colors ${
                    activeIndex === index ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <div className="text-muted-foreground mb-1 text-xs">
                    {formatTime(segment.start)} → {formatTime(segment.end)}
                  </div>
                  <div className="text-sm">{segment.text}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
