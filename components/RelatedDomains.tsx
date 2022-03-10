import NextLink from 'next/link';
import { Button, Stack } from '@chakra-ui/react';

type RelatedDomainsProps = {
  domain: string;
};

const RelatedDomains = ({ domain: original }: RelatedDomainsProps) => {
  const domains = [];

  const splitOriginal = original.split('.');
  for (let i = 1; i < splitOriginal.length - 1; i++) {
    const domain = splitOriginal.slice(i).join('.');
    domains.push(domain);
  }

  if (!original.startsWith('www.')) {
    domains.unshift(`www.${original}`);
  }

  return (
    <Stack spacing={4} direction="row" align="center">
      {domains.map((domain) => (
        <NextLink key={domain} href={`/lookup/${domain}`}>
          <a>
            <Button size="xs">{domain}</Button>
          </a>
        </NextLink>
      ))}
    </Stack>
  );
};

export default RelatedDomains;
