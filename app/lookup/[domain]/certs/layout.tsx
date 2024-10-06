import { InfoIcon } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { IconAlert } from '../_components/icon-alert';

type CertsLayoutProps = {
  children: ReactNode;
};

const CertsLayout: FC<CertsLayoutProps> = ({ children }) => (
  <>
    <IconAlert className="mx-auto my-12" icon={InfoIcon} title="How it works">
      Every certificate issued for a domain by a trusted CA{' '}
      <a
        className="underline decoration-dotted underline-offset-4"
        href="https://certificate.transparency.dev/"
        target="_blank"
        rel="noreferrer nofollow"
      >
        is publicly announced and stored
      </a>
      .<br />
      The entries on this page were collected by{' '}
      <a
        className="underline decoration-dotted underline-offset-4"
        href="https://crt.sh/"
        target="_blank"
        rel="noreferrer nofollow"
      >
        crt.sh
      </a>
      .
    </IconAlert>
    {children}
  </>
);

export default CertsLayout;
