import Image from 'next/image';
import type { FC, ReactNode } from 'react';

import { Card } from '@/components/ui/card';

type TestimonialProps = {
  children: ReactNode;
  from: {
    url: string;
    name: string;
    role: string;
    imgSrc: string;
  };
};

export const Testimonial: FC<TestimonialProps> = ({ children, from }) => (
  <Card className="p-8">
    <a className="flex items-center gap-3" href={from.url} target="_blank">
      <Image
        className="aspect-square h-12 rounded-full"
        src={from.imgSrc}
        width={12 * 4}
        height={12 * 4}
        alt={`Photo of ${from.name}`}
      />
      <div className="flex flex-col justify-center gap-0.5">
        <p className="text-sm font-semibold">{from.name}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{from.role}</p>
      </div>
    </a>
    <p className="mt-6">{children}</p>
  </Card>
);
