import Image from 'next/image';
import type { FC, HTMLAttributes, ReactNode } from 'react';

import { TrustedByLogos } from './trusted-by-logos';

type Person = {
  url: string;
  name: string;
  role: string;
  imgSrc: string;
};

const ANOUAR: Person = {
  url: 'https://www.linkedin.com/in/anouar-springer',
  name: 'Anouar Springer',
  role: 'Growth @ Superchat',
  imgSrc: '/assets/testimonials/anouar-springer.jpg',
};

const SAMUEL: Person = {
  url: 'https://www.linkedin.com/in/boguslawski',
  name: 'Samuel Boguslawski',
  role: 'Lecturer @ CODE University',
  imgSrc: '/assets/testimonials/samuel-boguslawski.jpg',
};

const MIGUEL: Person = {
  url: 'https://x.com/midudev',
  name: 'Miguel Ángel Durán',
  role: 'Content Creator',
  imgSrc: '/assets/testimonials/miguel-angel-duran.jpg',
};

type TrustSectionProps = HTMLAttributes<HTMLElement> & {
  subpage?: string;
};

export const TrustSection: FC<TrustSectionProps> = ({ subpage, ...props }) => (
  <section {...props}>
    <div className="flex flex-col items-center gap-5">
      <h2 className="text-center font-semibold">Trusted by experts at</h2>
      <TrustedByLogos subpage={subpage} />
    </div>

    <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      <TestimonialQuote from={ANOUAR}>
        <strong>
          A great help in improving our email deliverability.
        </strong>{' '}
        Checking domain settings is straightforward and the details are easy
        to act on.
      </TestimonialQuote>

      <TestimonialQuote from={SAMUEL}>
        I use Domain Digger in my classes to{' '}
        <strong>help students understand how the internet works.</strong> The
        interactive maps and visualizations make DNS click.
      </TestimonialQuote>

      {/* From https://x.com/midudev/status/1877021355989717196 */}
      <TestimonialQuote from={MIGUEL}>
        <strong>This resource is GOLD</strong> for Programmers and DevOps. A
        tool that gives you DNS, WHOIS, IPs, subdomains, certificates and
        more.
      </TestimonialQuote>
    </div>
  </section>
);

const TestimonialQuote: FC<{ from: Person; children: ReactNode }> = ({
  from,
  children,
}) => (
  <figure className="flex flex-col">
    <blockquote className="text-pretty text-zinc-700 [&_strong]:text-zinc-950 dark:text-zinc-300 dark:[&_strong]:text-white">
      {children}
    </blockquote>
    <figcaption className="mt-5">
      <a
        className="flex items-center gap-3"
        href={from.url}
        target="_blank"
      >
        <Image
          className="aspect-square h-9 w-9 rounded-full"
          src={from.imgSrc}
          width={36}
          height={36}
          alt={`Photo of ${from.name}`}
        />
        <div className="flex flex-col">
          <p className="text-sm font-semibold">{from.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {from.role}
          </p>
        </div>
      </a>
    </figcaption>
  </figure>
);
