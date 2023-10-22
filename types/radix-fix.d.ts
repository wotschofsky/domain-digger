// Temporary fix as described by https://github.com/shadcn-ui/ui/issues/1644#issuecomment-1744233612
// TODO Remove this file when the issue is fixed
import '@radix-ui/react-dialog';

declare module '@radix-ui/react-dialog' {
  export interface DialogPortalProps {
    className?: string;
  }
}
