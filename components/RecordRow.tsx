import { ExternalLinkIcon } from '@chakra-ui/icons';
import { FaInfoCircle } from 'react-icons/fa';
import { IconButton, Td, Tooltip, Tr, useDisclosure } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import isFQDN from 'validator/lib/isFQDN';
import isIP from 'validator/lib/isIP';

import { RawRecord } from '@/utils/DnsLookup';
import IpDetailsModal from '@/components/IpDetailsModal';

const RecordRow = ({ record }: { record: RawRecord }) => {
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();

  let specialAction = null;
  if (isIP(record.data)) {
    specialAction = (
      <>
        <Tooltip label="View IP Info">
          <IconButton
            variant="link"
            size="sm"
            ml={1}
            aria-label="View IP Info"
            icon={<FaInfoCircle />}
            onClick={onOpen}
          />
        </Tooltip>
        <IpDetailsModal ip={record.data} isOpen={isOpen} onClose={onClose} />
      </>
    );
  } else if (isFQDN(record.data.slice(0, -1))) {
    const targetDomain = record.data.slice(0, -1);
    specialAction = (
      <Tooltip label="View Domain Records">
        <IconButton
          variant="link"
          size="sm"
          ml={1}
          aria-label="View Domain Records"
          icon={<ExternalLinkIcon />}
          onClick={() => router.push(`/lookup/${targetDomain}`)}
        />
      </Tooltip>
    );
  }

  return (
    <>
      <Tr>
        <Td>{record.name}</Td>
        <Td>{record.TTL}</Td>
        <Td>
          {record.data}
          {specialAction}
        </Td>
      </Tr>
    </>
  );
};

export default RecordRow;
