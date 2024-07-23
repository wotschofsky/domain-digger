import { InfoIcon } from 'lucide-react';
import Link from 'next/link';
import type { FC, ReactNode } from 'react';

import { IconAlert } from '../_components/icon-alert';

type SubdomainsLayoutProps = {
  children: ReactNode;
  params: {
    domain: string;
  };
};

const SubdomainsLayout: FC<SubdomainsLayoutProps> = ({
  children,
  params: { domain },
}) => (
  <>
    <IconAlert className="my-12" icon={InfoIcon} title="How it works">
      This is a deduplicated list of all subdomains found in the{' '}
      <Link
        className="underline decoration-dotted underline-offset-4"
        href={`/lookup/${domain}/certs`}
      >
        certificate transparency logs
      </Link>{' '}
      for this domain.
    </IconAlert>
    {children}
  </>
);

export default SubdomainsLayout;
