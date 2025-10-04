'use client';

import { PauseCircle, Play, PlayCircle, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Slider } from '../../ui/slider';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  className?: string;
  onLoadedData?: () => void;
  onEnded?: () => void;
  onError?: () => void;
}

export function AudioPlayer({ src, className, onLoadedData, onEnded, onError }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(1); // 0-1 范围
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVolumeControl, setShowVolumeControl] = useState(false);

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

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('loadeddata', onLoadedData || (() => {}));
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
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

  return (
    <div className={cn('bg-background flex w-full flex-col gap-2 rounded-full px-4 py-2', className)}>
      {/* 音频元素 */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* 播放控制区域 */}
      <div className="flex items-center gap-1">
        {/* 播放/暂停按钮 */}
        <button
          onClick={togglePlayPause}
          className="hover:bg-muted flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors"
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <PauseCircle className="h-6 w-6" /> : <PlayCircle className="h-6 w-6" />}
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
      </div>
    </div>
  );
}
