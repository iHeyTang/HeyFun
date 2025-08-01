import * as React from 'react';

import { cn } from '@/lib/utils';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

function InputPassword({ className, type, showPasswordToggle, ...props }: React.ComponentProps<'input'> & { showPasswordToggle?: boolean }) {
  const [showPassword, setShowPassword] = React.useState(false);
  return (
    <div className="group relative">
      <input
        type={showPassword ? 'text' : 'password'}
        data-slot="input"
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      />
      {showPasswordToggle && (
        <div
          className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
        </div>
      )}
    </div>
  );
}

export { InputPassword };
