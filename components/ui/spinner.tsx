import * as React from 'react';

import { cn } from '@/lib/utils';

import styles from './spinner.module.css';

const Spinner = React.forwardRef<
  HTMLOutputElement,
  React.OutputHTMLAttributes<HTMLOutputElement>
>(({ className, ...props }, ref) => (
  <output ref={ref} className={cn('block size-9', className)} {...props}>
    <span className="sr-only">Loading...</span>

    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
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
  </output>
));
Spinner.displayName = 'Spinner';

export { Spinner };
