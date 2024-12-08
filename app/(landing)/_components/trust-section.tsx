import type { FC, HTMLAttributes } from 'react';

import { TrustedByLogos } from './trusted-by-logos';

type TrustSectionProps = HTMLAttributes<HTMLElement> & {
  subpage?: string;
};

export const TrustSection: FC<TrustSectionProps> = (props) => (
  <section {...props}>
    <div className="flex flex-col items-center gap-5">
      <h2 className="text-center font-semibold">Trusted by experts at</h2>
      <TrustedByLogos subpage={props.subpage} />
    </div>
  </section>
);
