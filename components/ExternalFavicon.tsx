import Image from 'next/image';
import { type FC, useCallback, useState } from 'react';

type ExternalFavicon = {
  url: string;
};

const ExternalFavicon: FC<ExternalFavicon> = ({ url }) => {
  return (
    <Image
      src={`https://www.google.com/s2/favicons?sz=32&domain_url=${url}`}
      alt={''}
      width={32}
      height={32}
      className="my-auto inline-block h-8 w-8 rounded-sm"
    />
  );
};

export default ExternalFavicon;
