'use client';

import React, { useRef, useEffect } from 'react';

export interface FolderInputProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  level: number;
  disabled?: boolean;
}

export const FolderInput = React.forwardRef<HTMLInputElement, FolderInputProps>(
  ({ value, onChange, onConfirm, onCancel, level, disabled }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isInitialFocusRef = useRef(true);
    const blurTimerRef = useRef<NodeJS.Timeout | null>(null);
    const hasAutoFocusedRef = useRef(false);
    const isFocusedRef = useRef(false);

    // 合并 ref
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(inputRef.current);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = inputRef.current;
      }
    }, [ref]);

    // 自动聚焦并选中文本（仅执行一次）
    useEffect(() => {
      if (inputRef.current && !hasAutoFocusedRef.current) {
        hasAutoFocusedRef.current = true;
        // 使用 setTimeout 确保 DOM 已渲染
        const timer = setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
            isFocusedRef.current = true;
            // 标记已完成初始聚焦，短暂延迟后允许 blur 处理
            setTimeout(() => {
              isInitialFocusRef.current = false;
            }, 100);
          }
        }, 0);
        return () => clearTimeout(timer);
      }
    }, []);

    // 清理定时器
    useEffect(() => {
      return () => {
        if (blurTimerRef.current) {
          clearTimeout(blurTimerRef.current);
        }
      };
    }, []);

    return (
      <div className="my-1.5 px-2" style={{ paddingLeft: `${level * 16 + 8}px` }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => {
            const newValue = e.target.value;
            onChange(newValue);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onConfirm();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          onBlur={e => {
            // 如果是初始聚焦阶段，忽略 blur 事件
            if (isInitialFocusRef.current) {
              return;
            }
            isFocusedRef.current = false;
            // 延迟处理，避免点击按钮时立即触发
            blurTimerRef.current = setTimeout(() => {
              // 再次检查输入框是否真的失去焦点，且用户没有重新聚焦
              if (inputRef.current && document.activeElement !== inputRef.current && !isFocusedRef.current) {
                if (value.trim()) {
                  onConfirm();
                } else {
                  onCancel();
                }
              }
            }, 300);
          }}
          onFocus={() => {
            isFocusedRef.current = true;
            // 清除可能存在的 blur 定时器
            if (blurTimerRef.current) {
              clearTimeout(blurTimerRef.current);
              blurTimerRef.current = null;
            }
          }}
          onClick={e => {
            // 如果用户点击输入框，且已经完成初始聚焦，确保不会全选
            if (hasAutoFocusedRef.current && !isInitialFocusRef.current) {
              const target = e.target as HTMLInputElement;
              // 如果当前是全选状态，将光标移到末尾
              if (target.selectionStart === 0 && target.selectionEnd === target.value.length && target.value.length > 0) {
                const end = target.value.length;
                setTimeout(() => {
                  if (inputRef.current) {
                    inputRef.current.setSelectionRange(end, end);
                  }
                }, 0);
              }
            }
          }}
          className="border-input bg-background focus:ring-ring w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1"
          disabled={disabled}
        />
      </div>
    );
  },
);

FolderInput.displayName = 'FolderInput';

