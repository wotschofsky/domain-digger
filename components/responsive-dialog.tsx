'use client';

import { useWindowSize } from '@uidotdev/usehooks';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from './ui/drawer';

export type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: string;
  children: ReactNode;
  className?: string;
};

// Keep the header outside the mobile scroll area: Vaul's background extension
// must never become scrollable content. Closed children unmount to stop fetching
// and reset view-specific state when the dialog is next opened.
export const ResponsiveDialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ResponsiveDialogProps) => {
  const { width } = useWindowSize();
  if (width && width < 640)
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn('max-h-[90dvh] overflow-hidden', className)}
        >
          <DrawerHeader className="shrink-0">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {description}
            </DrawerDescription>
          </DrawerHeader>
          <div className="mt-4 min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-contain">
            {open && children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-4">{open && children}</div>
      </DialogContent>
    </Dialog>
  );
};
