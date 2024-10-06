import type { LucideIcon } from 'lucide-react';
import type { FC } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { cn } from '@/lib/utils';

type IconAlertProps = {
  className?: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
};

export const IconAlert: FC<IconAlertProps> = ({
  className,
  icon: Icon,
  title,
  children,
}) => (
  <Alert className={cn('max-w-max', className)}>
    <Icon className="h-4 w-4" />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{children}</AlertDescription>
  </Alert>
);
