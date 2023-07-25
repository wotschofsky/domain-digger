'use client';

import { CheckIcon, ClipboardIcon } from 'lucide-react';
import { type FC, useCallback, useState } from 'react';

type CopyButton = {
  value: string;
};

const CopyButton: FC<CopyButton> = ({ value }) => {
  const [wasCopied, setWasCopied] = useState(false);
  const copy = useCallback(() => {
    setWasCopied(true);
    navigator.clipboard.writeText(value);
    setTimeout(() => setWasCopied(false), 2000);
  }, [value, setWasCopied]);

  if (wasCopied) {
    return <CheckIcon className="mx-1 inline-block h-4 w-4 -translate-y-0.5" />;
  }

  return (
    <ClipboardIcon
      role="button"
      className="mx-1 inline-block h-4 w-4 -translate-y-0.5 cursor-pointer"
      onClick={copy}
    />
  );
};

export default CopyButton;
