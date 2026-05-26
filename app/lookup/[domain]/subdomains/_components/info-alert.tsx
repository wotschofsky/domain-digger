import { InfoIcon } from 'lucide-react';
import type { FC } from 'react';

import { IconAlert } from '../../_components/icon-alert';

export const SubdomainsInfoAlert: FC = () => (
  <IconAlert icon={InfoIcon} title="How it works">
    A deduplicated list of subdomains discovered via passive sources.
  </IconAlert>
);
