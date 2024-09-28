import * as React from 'react';

import { cn } from '@/lib/utils';

const Spinner = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'my-8 inline-block h-9 w-9 animate-[spin_0.6s_linear_infinite] rounded-full border-[2px] border-current border-t-transparent text-gray-800',
      className,
    )}
    role="status"
    aria-label="loading"
    {...props}
  >
    <span className="sr-only">Loading...</span>
  </div>
));
Spinner.displayName = 'Spinner';

export { Spinner };
