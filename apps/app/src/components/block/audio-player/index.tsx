'use client';

import { FileText, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Slider } from '../../ui/slider';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../../ui/scroll-area';
import { Dialog, DialogContent, DialogTrigger } from '../../ui/dialog';

// 字幕数据结构
interface SubtitleWord {
  start_time: number; // 毫秒
  end_time: number; // 毫秒
  text: string;
}

interface SubtitleUtterance {
  start_time: number; // 毫秒
  end_time: number; // 毫秒
  text: string;
  words?: SubtitleWord[];
}

interface SubtitleSegment {
  start: number; // 秒
  end: number; // 秒
  text: string;
}

interface SubtitleData {
  text: string;
  segments?: SubtitleSegment[];
  utterances?: SubtitleUtterance[];
  duration?: number;
}

interface AudioPlayerProps {
  src: string;
  className?: string;
  subtitle?: SubtitleData | string; // 字幕数据或字幕 JSON 文件 URL
  onLoadedData?: () => void;
  onEnded?: () => void;
  onError?: () => void;
}

export function AudioPlayer({ src, className, subtitle, onLoadedData, onEnded, onError }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(1); // 0-1 范围
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVolumeControl, setShowVolumeControl] = useState(false);

  // 字幕相关状态
  // 如果 subtitle 是对象，直接初始化为 subtitle，否则为 null
  const [subtitleData, setSubtitleData] = useState<SubtitleData | null>(subtitle && typeof subtitle === 'object' ? subtitle : null);
  const [loadingSubtitle, setLoadingSubtitle] = useState(subtitle && typeof subtitle === 'string' ? true : false);
  const [activeUtteranceIndex, setActiveUtteranceIndex] = useState(-1);
  const [activeWordIndex, setActiveWordIndex] = useState<{ utteranceIndex: number; wordIndex: number } | null>(null);
  const subtitleScrollRef = useRef<HTMLDivElement>(null);

  // 处理音量变化
  const handleVolumeChange = useCallback(
    (value: number[]) => {
      const volumeValue = value[0];
      if (volumeValue === undefined) return;

      const newVolume = volumeValue / 100; // 转换为 0-1 范围
      setVolume(newVolume);
      const audio = audioRef.current;
      if (audio) {
        audio.volume = newVolume;
      }
      // 如果音量大于0，取消静音
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
      }
    },
    [isMuted],
  );

  // 切换静音状态
  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      if (isMuted) {
        // 取消静音，恢复之前的音量
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        // 静音
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [isMuted, volume]);

  // 切换音量控制显示状态
  const toggleVolumeControl = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setShowVolumeControl(prev => !prev);
  }, []);

  // 处理播放/暂停
  const togglePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
    }
  }, [isPlaying]);

  // 处理时间更新
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  // 处理进度条点击
  const handleSeek = useCallback(
    (value: number[]) => {
      const seekValue = value[0];
      if (seekValue === undefined) return;

      const audio = audioRef.current;
      if (audio) {
        const newTime = (seekValue / 100) * duration;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
      }
    },
    [duration],
  );

  // 格式化时间
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 加载字幕数据
  useEffect(() => {
    // 如果 subtitle 是对象，直接使用，不需要异步加载
    if (typeof subtitle === 'object') {
      console.log('[AudioPlayer] Subtitle is object, setting data immediately');
      // 使用 queueMicrotask 避免在 effect 中同步调用 setState
      queueMicrotask(() => {
        setSubtitleData(subtitle);
        setLoadingSubtitle(false);
      });
      return;
    }

    if (!subtitle) {
      const rafId = requestAnimationFrame(() => {
        setSubtitleData(null);
        setLoadingSubtitle(false);
      });
      return () => cancelAnimationFrame(rafId);
    }

    // 如果是 URL，需要加载
    if (typeof subtitle === 'string') {
      const rafId = requestAnimationFrame(() => {
        setLoadingSubtitle(true);
      });
      fetch(subtitle)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to load subtitle: ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          setSubtitleData(data);
        })
        .catch(err => {
          console.error('Failed to load subtitle:', err);
          setSubtitleData(null);
        })
        .finally(() => {
          setLoadingSubtitle(false);
          cancelAnimationFrame(rafId);
        });
    }
  }, [subtitle]);

  // 处理字幕高亮（单词/字级别）
  useEffect(() => {
    if (!subtitleData || !audioRef.current) return;

    const audio = audioRef.current;
    const currentTimeMs = currentTime * 1000; // 转换为毫秒

    // 使用 requestAnimationFrame 避免同步 setState
    const rafId = requestAnimationFrame(() => {
      // 查找当前活跃的 utterance
      if (subtitleData.utterances) {
        const utteranceIndex = subtitleData.utterances.findIndex(u => currentTimeMs >= u.start_time && currentTimeMs <= u.end_time);

        if (utteranceIndex !== -1) {
          setActiveUtteranceIndex(utteranceIndex);
          const utterance = subtitleData.utterances?.[utteranceIndex];

          // 如果有单词级别数据，查找当前活跃的单词
          if (utterance && utterance.words && utterance.words.length > 0) {
            // 首先尝试精确匹配
            let wordIndex = utterance.words.findIndex(w => currentTimeMs >= w.start_time && currentTimeMs <= w.end_time);

            // 如果找不到精确匹配，找最接近的单词（在 utterance 时间范围内）
            if (wordIndex === -1) {
              // 找到第一个开始时间大于当前时间的单词，然后选择前一个
              const nextWordIndex = utterance.words.findIndex(w => w.start_time > currentTimeMs);
              if (nextWordIndex > 0) {
                // 选择前一个单词
                wordIndex = nextWordIndex - 1;
              } else if (nextWordIndex === -1 && utterance.words.length > 0) {
                // 如果当前时间超过了所有单词，选择最后一个单词
                wordIndex = utterance.words.length - 1;
              } else if (nextWordIndex === 0 && currentTimeMs >= utterance.start_time) {
                // 如果当前时间在第一个单词之前但在 utterance 范围内，选择第一个单词
                wordIndex = 0;
              }
            }

            if (wordIndex !== -1) {
              setActiveWordIndex({ utteranceIndex, wordIndex });
            } else {
              setActiveWordIndex(null);
            }
          } else {
            setActiveWordIndex(null);
          }

          // 自动滚动到当前 utterance
          if (subtitleScrollRef.current && utteranceIndex >= 0) {
            const utteranceElement = subtitleScrollRef.current.querySelector(`[data-utterance-index="${utteranceIndex}"]`);
            if (utteranceElement) {
              utteranceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        } else {
          setActiveUtteranceIndex(-1);
          setActiveWordIndex(null);
        }
      } else if (subtitleData.segments) {
        // 如果没有 utterances，使用 segments
        const segmentIndex = subtitleData.segments.findIndex(s => currentTime >= s.start && currentTime <= s.end);
        setActiveUtteranceIndex(segmentIndex);
        setActiveWordIndex(null);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentTime, subtitleData]);

  // 跳转到指定时间
  const seekToTime = useCallback(
    (timeInSeconds: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = timeInSeconds;
        if (!isPlaying) {
          audioRef.current.play().catch(console.error);
        }
      }
    },
    [isPlaying],
  );

  // 处理单词点击
  const handleWordClick = useCallback(
    (utteranceIndex: number, word: SubtitleWord) => {
      seekToTime(word.start_time / 1000);
    },
    [seekToTime],
  );

  // 处理 utterance 点击
  const handleUtteranceClick = useCallback(
    (utterance: SubtitleUtterance) => {
      seekToTime(utterance.start_time / 1000);
    },
    [seekToTime],
  );

  // 处理 segment 点击
  const handleSegmentClick = useCallback(
    (segment: SubtitleSegment) => {
      seekToTime(segment.start);
    },
    [seekToTime],
  );

  // 监听音频事件
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handleError = () => {
      setIsPlaying(false);
      onError?.();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('loadeddata', onLoadedData || (() => {}));
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // 使用 requestAnimationFrame 更频繁地更新当前时间，确保单词高亮更及时
    let rafId: number | null = null;
    const updateTime = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
        rafId = requestAnimationFrame(updateTime);
      }
    };

    // 当播放时启动高频更新
    if (!audio.paused) {
      rafId = requestAnimationFrame(updateTime);
    }

    // 监听播放状态变化，启动或停止高频更新
    const handlePlayForRaf = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(updateTime);
      }
    };
    const handlePauseForRaf = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    audio.addEventListener('play', handlePlayForRaf);
    audio.addEventListener('pause', handlePauseForRaf);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('loadeddata', onLoadedData || (() => {}));
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('play', handlePlayForRaf);
      audio.removeEventListener('pause', handlePauseForRaf);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [handleTimeUpdate, onLoadedData, onEnded, onError]);

  // 设置初始音量
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // 点击外部区域时隐藏音量控制
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // 如果点击的不是音量控制相关的元素，则隐藏音量控制
      if (showVolumeControl && !target.closest('[data-volume-control]')) {
        setShowVolumeControl(false);
      }
    };

    if (showVolumeControl) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showVolumeControl]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumePercentage = isMuted ? 0 : volume * 100;

  // 渲染单词级别字幕
  const renderWordLevelSubtitle = (utterance: SubtitleUtterance, utteranceIndex: number) => {
    if (!utterance.words || utterance.words.length === 0) {
      return <span>{utterance.text}</span>;
    }

    return (
      <>
        {utterance.words.map((word, wordIndex) => {
          const isActive = activeWordIndex?.utteranceIndex === utteranceIndex && activeWordIndex?.wordIndex === wordIndex;
          return (
            <span
              key={wordIndex}
              onClick={() => handleWordClick(utteranceIndex, word)}
              className={cn(
                'relative cursor-pointer transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:bg-muted/60',
                isActive &&
                  'before:bg-primary/20 before:absolute before:-inset-x-1 before:-inset-y-0.5 before:z-[-1] before:rounded before:content-[""]',
              )}
              title={`${(word.start_time / 1000).toFixed(2)}s - ${(word.end_time / 1000).toFixed(2)}s`}
            >
              {word.text}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div className={cn('bg-background flex w-full flex-col gap-2 border', subtitleData ? 'rounded-lg p-4' : 'rounded-full px-4 py-2', className)}>
      {/* 音频元素 */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* 播放控制区域 */}
      <div className="flex items-center gap-1">
        {/* 播放/暂停按钮 */}
        <button
          onClick={togglePlayPause}
          className="hover:bg-muted/80 bg-background flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors"
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        {/* 音量控制区域 */}
        <div className="relative" data-volume-control>
          {/* 音量按钮 */}
          <button
            onClick={toggleVolumeControl}
            className="text-muted-foreground hover:text-foreground flex h-6 w-6 cursor-pointer items-center justify-center transition-colors"
            aria-label={showVolumeControl ? '隐藏音量控制' : '显示音量控制'}
          >
            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* 音量滑块浮动层 - 条件显示 */}
          {showVolumeControl && (
            <div
              className="bg-background absolute bottom-full left-0 mb-2 flex items-center gap-2 rounded-lg p-2 shadow"
              onClick={e => e.stopPropagation()}
            >
              {/* 音量滑块  */}
              <div className="w-30">
                <Slider value={[volumePercentage]} onValueChange={handleVolumeChange} max={100} className="h-full cursor-pointer" />
              </div>

              {/* 音量百分比显示 */}
              <div className="text-muted-foreground text-xs">{Math.round(volumePercentage)}%</div>
            </div>
          )}
        </div>

        {/* 进度条 */}
        <div className="flex-1">
          <Slider value={[progressPercentage]} onValueChange={handleSeek} max={100} className="w-full cursor-pointer" />
        </div>

        {/* 时间显示 */}
        <div className="text-muted-foreground min-w-[80px] text-right text-xs">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* 全文按钮 - 仅在存在字幕数据且有全文时显示 */}
        {subtitleData && subtitleData.text && (
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="text-muted-foreground hover:text-foreground flex h-6 w-6 cursor-pointer items-center justify-center transition-colors"
                aria-label="查看全文"
              >
                <FileText className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" showCloseButton={false}>
              <div className="text-sm leading-relaxed">{subtitleData.text}</div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* 字幕显示区域 */}
      {loadingSubtitle && !subtitleData && (
        <div className="flex items-center justify-center py-2">
          <div className="text-muted-foreground text-xs">加载字幕中...</div>
        </div>
      )}

      {subtitleData && (
        <div className="border-t pt-2">
          {/* 字幕列表 */}
          <ScrollArea className="h-48 pr-3" ref={subtitleScrollRef}>
            <div className="space-y-0 text-sm leading-relaxed">
              {/* 优先显示单词级别字幕 */}
              {subtitleData.utterances && subtitleData.utterances.some(u => u.words && u.words.length > 0)
                ? subtitleData.utterances.map((utterance, utteranceIndex) => {
                    const isActive = activeUtteranceIndex === utteranceIndex;
                    return (
                      <div
                        key={utteranceIndex}
                        data-utterance-index={utteranceIndex}
                        onClick={() => handleUtteranceClick(utterance)}
                        className={cn(
                          'flex cursor-pointer items-baseline gap-2 rounded-md px-2 py-1 transition-colors',
                          isActive ? 'bg-primary/10' : 'hover:bg-muted/60',
                        )}
                      >
                        <span className="text-muted-foreground shrink-0 text-xs">[{formatTime(utterance.start_time / 1000)}]</span>
                        <span className="flex-1">{renderWordLevelSubtitle(utterance, utteranceIndex)}</span>
                      </div>
                    );
                  })
                : // 段落级别字幕
                  (
                    subtitleData.segments ||
                    subtitleData.utterances?.map(u => ({
                      start: u.start_time / 1000,
                      end: u.end_time / 1000,
                      text: u.text,
                    })) ||
                    []
                  ).map((segment, index) => {
                    const isActive = activeUtteranceIndex === index;
                    return (
                      <div
                        key={index}
                        data-segment-index={index}
                        onClick={() => handleSegmentClick(segment)}
                        className={cn(
                          'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 transition-colors',
                          isActive ? 'bg-primary/10' : 'hover:bg-muted/60',
                        )}
                      >
                        <span className="text-muted-foreground shrink-0 text-xs">[{formatTime(segment.start)}]</span>
                        <span className="flex-1">{segment.text}</span>
                      </div>
                    );
                  })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
