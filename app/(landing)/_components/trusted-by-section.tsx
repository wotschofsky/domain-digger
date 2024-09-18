import type { FC, HTMLAttributes } from 'react';

import { TrustedByLogos } from './trusted-by-logos';

type TrustedBySectionProps = HTMLAttributes<HTMLElement> & {
  subpage?: string;
};

export const TrustedBySection: FC<TrustedBySectionProps> = (props) => (
  <section {...props}>
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-center font-semibold sm:text-lg">
        Trusted by experts at
      </h2>

      <TrustedByLogos subpage={props.subpage} />

      <a
        href="https://www.producthunt.com/posts/domain-digger?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-domain&#0045;digger"
        target="_blank"
        className="mt-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=434616&theme=neutral"
          alt="Domain&#0032;Digger - Full&#0032;open&#0045;source&#0032;toolkit&#0032;for&#0032;next&#0045;level&#0032;domain&#0032;analysis | Product Hunt"
          style={{ width: '250px', height: '54px' }}
          width="250"
          height="54"
        />
      </a>
    </div>
  </section>
);
