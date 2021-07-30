import {
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  Td,
  Tr,
} from '@chakra-ui/react';
import useSWR from 'swr';

import type { IpLookupResponse } from '@/api/lookupIp';

type IpDetailsModalProps = {
  ip: string;
  isOpen: boolean;
  onClose: () => void;
};

const IpDetailsModal = (props: IpDetailsModalProps) => {
  const { data, error } = useSWR<IpLookupResponse>(
    props.isOpen ? `/api/lookupIp?ip=${encodeURIComponent(props.ip)}` : null
  );

  let mappedEntries: { label: string; value: string }[] = [];
  if (data) {
    mappedEntries = [
      {
        label: 'IP',
        value: props.ip,
      },
      ...data.reverse.map((address) => ({
        label: 'Reverse',
        value: address,
      })),
      {
        label: 'Organization',
        value: data.org,
      },
      {
        label: 'ISP',
        value: data.isp,
      },
      {
        label: 'Location',
        value: `${data.country}, ${data.region}, ${data.city}`,
      },
      {
        label: 'Coordinates',
        value: `Latitude: ${data.lat}; Longitude: ${data.lon}`,
      },
      {
        label: 'Timezone',
        value: data.timezone,
      },
    ];
  }

  return (
    <Modal size="xl" isOpen={props.isOpen} onClose={props.onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>IP Details for {props.ip}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!data ? (
            <Flex justify="center" align="center">
              <Spinner size="xl" my={8} />
            </Flex>
          ) : error ? (
            <p>An error occurred!</p>
          ) : (
            <>
              <Table>
                {mappedEntries.map((el) => (
                  <Tr key={el.label + el.value}>
                    <Td pl={0}>{el.label}</Td>
                    <Td pr={0}>{el.value}</Td>
                  </Tr>
                ))}
              </Table>
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default IpDetailsModal;
