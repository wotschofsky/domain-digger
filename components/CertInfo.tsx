import { ExternalLinkIcon } from '@chakra-ui/icons';
import {
  Flex,
  IconButton,
  Link,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import useSWR from 'swr';

import type { CertLookupResponse } from '@/api/lookupCerts';

type CertInfoProps = {
  domain: string;
};

const CertInfo = ({ domain }: CertInfoProps) => {
  const { data, error } = useSWR<CertLookupResponse>(
    `/api/lookupCerts?domain=${encodeURIComponent(domain)}`
  );

  if (!data) {
    return (
      <Flex justify="center" align="center">
        <Spinner size="xl" my={8} />
      </Flex>
    );
  }

  if (error) {
    return <p>An error occurred!</p>;
  }

  if (!data.certificates.length) {
    return (
      <Text textAlign="center" color="gray.500" mt={8}>
        No issued certificates found!
      </Text>
    );
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th pl={0}>Logged At</Th>
          <Th>Not Before</Th>
          <Th>Not After</Th>
          <Th>Common Name</Th>
          <Th>Matching Identities</Th>
          <Th pr={0}>Issuer Name</Th>
        </Tr>
      </Thead>
      <Tbody>
        {data.certificates.map((cert) => (
          <Tr key={cert.id}>
            <Td pl={0}>{cert.loggedAt}</Td>
            <Td>{cert.notBefore}</Td>
            <Td>{cert.notAfter}</Td>
            <Td>
              <>
                <span>{cert.commonName}</span>{' '}
                <Tooltip label="View Domain Records">
                  <NextLink href={`/lookup/${cert.commonName}`} passHref legacyBehavior>
                    <Link>
                      <IconButton
                        variant="link"
                        size="sm"
                        ml={-2.5}
                        mr={-1.5}
                        aria-label="View Domain Records"
                        icon={<ExternalLinkIcon />}
                      />
                    </Link>
                  </NextLink>
                </Tooltip>
              </>
            </Td>
            <Td>
              {cert.matchingIdentities.split(/\n/g).map((value, index) => (
                <>
                  {index !== 0 && <br />}
                  <span>{value}</span>{' '}
                  <Tooltip label="View Domain Records">
                    <NextLink href={`/lookup/${value}`} passHref legacyBehavior>
                      <Link>
                        <IconButton
                          variant="link"
                          size="sm"
                          ml={-2.5}
                          mr={-1.5}
                          aria-label="View Domain Records"
                          icon={<ExternalLinkIcon />}
                        />
                      </Link>
                    </NextLink>
                  </Tooltip>
                </>
              ))}
            </Td>
            <Td pr={0}>{cert.issuerName}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

export default CertInfo;
