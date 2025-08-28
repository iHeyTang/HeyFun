import binaryExtensions from 'binary-extensions';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  num: number,
  config: {
    autoUnit?: boolean;
    uppercase?: boolean;
  } = {},
) {
  const { autoUnit = false, uppercase = false } = config;

  if (autoUnit) {
    const baseUnits = ['', 'k', 'm', 'b', 't'];
    const units = uppercase ? baseUnits.map(u => u.toUpperCase()) : baseUnits;
    const order = Math.floor(Math.log10(Math.abs(num)) / 3);
    const unitName = units[order] || '';

    if (order > 0) {
      const scaled = num / Math.pow(1000, order);
      return (
        scaled.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        }) + unitName
      );
    }
  }

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function isBinaryFile(path: string): boolean {
  return binaryExtensions.includes(path.split('.').pop()?.toLowerCase() || '');
}

export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
