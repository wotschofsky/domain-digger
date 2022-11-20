import { ExternalLinkIcon } from '@chakra-ui/icons';
import { FaInfoCircle } from 'react-icons/fa';
import {
  IconButton,
  Link,
  Td,
  Tooltip,
  Tr,
  useDisclosure,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { ReactNodeArray, useEffect, useState } from 'react';
import isIP from 'validator/lib/isIP';
import NextLink from 'next/link';
import reactStringReplace from 'react-string-replace';

import { RawRecord } from '@/utils/DnsLookup';
import IpDetailsModal from '@/components/IpDetailsModal';

const domainRegex =
  /(_)*(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g;

const RecordRow = ({ record }: { record: RawRecord }) => {
  // const router = useRouter();
  const [detailedIp, setDetailedIp] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // useEffect(() => {
  //   router.events.on('routeChangeStart', onClose);

  //   return () => {
  //     router.events.off('routeChangeStart', onClose);
  //   };
  // });

  let interpolatedValue: ReactNodeArray | null = null;

  const domainMatches = record.data.match(domainRegex);
  if (domainMatches) {
    for (const domain of domainMatches) {
      interpolatedValue = reactStringReplace(
        interpolatedValue ? interpolatedValue : record.data,
        domain,
        (match) => {
          if (isIP(match)) {
            return (
              <>
                <span>{match}</span>{' '}
                <Tooltip label="View IP Info">
                  <IconButton
                    variant="link"
                    size="sm"
                    ml={-2.5}
                    mr={-1.5}
                    aria-label="View IP Info"
                    icon={<FaInfoCircle />}
                    onClick={() => {
                      setDetailedIp(match);
                      onOpen();
                    }}
                  />
                </Tooltip>
              </>
            );
          }

          return <>
            <span>{match}</span>{' '}
            <Tooltip label="View Domain Records">
              <NextLink href={`/lookup/${match}`} passHref legacyBehavior>
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
          </>;
        }
      );
    }
  }

  return (
    <>
      <Tr>
        <Td pl={0}>{record.name}</Td>
        <Td>{record.TTL}</Td>
        <Td pr={0}>{interpolatedValue ? interpolatedValue : record.data}</Td>
      </Tr>

      <IpDetailsModal
        ip={detailedIp as string}
        isOpen={isOpen}
        onClose={onClose}
      />
    </>
  );
};

export default RecordRow;
