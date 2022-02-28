import NextLink from 'next/link';
import { Link } from '@chakra-ui/react';

type InvertedWWWLinkProps = {
  domain: string;
};

const InvertedWWWLink = ({ domain: original }: InvertedWWWLinkProps) => {
  const isWWW = original.startsWith('www.');
  const inverted = isWWW ? original.substring(4) : `www.${original}`;

  return (
    <NextLink href={`/lookup/${inverted}`} passHref>
      <Link>Look up {inverted}</Link>
    </NextLink>
  );
};

export default InvertedWWWLink;
