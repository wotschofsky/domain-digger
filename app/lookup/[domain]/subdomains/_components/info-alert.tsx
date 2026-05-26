import { InfoIcon } from 'lucide-react';
import type { FC } from 'react';

import { IconAlert } from '../../_components/icon-alert';

export const SubdomainsInfoAlert: FC = () => (
  <IconAlert icon={InfoIcon} title="How it works">
    This is a deduplicated list of subdomains discovered by aggregating results
    from passive sources such as certificate transparency logs, DNS history
    archives, and public threat intelligence feeds.
  </IconAlert>
);
