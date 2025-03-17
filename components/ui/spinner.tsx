import * as React from 'react';

import { cn } from '@/lib/utils';

import styles from './spinner.module.css';

const Spinner = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('h-9 w-9', className)}
    role="status"
    aria-label="loading"
    {...props}
  >
    <span className="sr-only">Loading...</span>

    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full text-gray-900 dark:text-gray-400"
    >
      <g className={cn('origin-center', styles.circle)}>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          opacity="1"
          className="fill-current"
        ></rect>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          transform="rotate(36 12 12)"
          opacity=".1"
          className="fill-current"
        ></rect>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          transform="rotate(72 12 12)"
          opacity=".2"
          className="fill-current"
        ></rect>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          transform="rotate(108 12 12)"
          opacity=".3"
          className="fill-current"
        ></rect>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          transform="rotate(144 12 12)"
          opacity=".4"
          className="fill-current"
        ></rect>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          transform="rotate(180 12 12)"
          opacity=".5"
          className="fill-current"
        ></rect>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          transform="rotate(216 12 12)"
          opacity=".6"
          className="fill-current"
        ></rect>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          transform="rotate(252 12 12)"
          opacity=".7"
          className="fill-current"
        ></rect>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          transform="rotate(288 12 12)"
          opacity=".8"
          className="fill-current"
        ></rect>
        <rect
          x="11"
          y="1"
          width="2"
          height="6"
          transform="rotate(324 12 12)"
          opacity=".9"
          className="fill-current"
        ></rect>
      </g>
    </svg>
    <span className="sr-only">Loading...</span>
  </div>
));
Spinner.displayName = 'Spinner';

export { Spinner };
