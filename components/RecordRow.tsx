import { FaInfoCircle } from 'react-icons/fa';
import { IconButton, Td, Tr, useDisclosure } from '@chakra-ui/react';
import isIP from 'validator/lib/isIP';

import { RawRecord } from '@/utils/DnsLookup';
import IpDetailsModal from '@/components/IpDetailsModal';

const RecordRow = ({ record }: { record: RawRecord }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const recordIsIp = isIP(record.data);

  return (
    <>
      <Tr>
        <Td>{record.name}</Td>
        <Td>{record.TTL}</Td>
        <Td>
          {record.data}
          {recordIsIp && (
            <IconButton
              variant="link"
              size="sm"
              ml={1}
              aria-label="Get IP Info"
              icon={<FaInfoCircle size="16px" />}
              onClick={onOpen}
            />
          )}
        </Td>
      </Tr>

      {recordIsIp && (
        <IpDetailsModal ip={record.data} isOpen={isOpen} onClose={onClose} />
      )}
    </>
  );
};

export default RecordRow;
