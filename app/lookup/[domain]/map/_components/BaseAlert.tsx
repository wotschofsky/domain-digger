import type { LucideIcon } from 'lucide-react';
import type { FC } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type BaseAlertProps = {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
};

const BaseAlert: FC<BaseAlertProps> = ({ icon: Icon, title, children }) => (
  <Alert className="mx-auto mt-24 max-w-max">
    <Icon className="h-4 w-4" />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{children}</AlertDescription>
  </Alert>
);

export default BaseAlert;
