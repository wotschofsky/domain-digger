import { InfoIcon } from 'lucide-react';
import Link from 'next/link';
import type { FC } from 'react';

import { IconAlert } from '../../_components/icon-alert';

type SubdomainsInfoAlertProps = {
  domain?: string;
};

export const SubdomainsInfoAlert: FC<SubdomainsInfoAlertProps> = ({
  domain,
}) => (
  <IconAlert icon={InfoIcon} title="How it works">
    This is a deduplicated list of all subdomains found in the{' '}
    {domain ? (
      <Link
        className="underline decoration-dotted underline-offset-4"
        href={`/lookup/${domain}/certs`}
      >
        certificate transparency logs
      </Link>
    ) : (
      'certificate transparency logs'
    )}{' '}
    for this domain.
  </IconAlert>
);
