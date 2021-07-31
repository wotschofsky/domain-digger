import dynamic from 'next/dynamic';
import {
  chakra,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  Tbody,
  Td,
  Tr,
} from '@chakra-ui/react';
import useSWR from 'swr';
import type { LatLngExpression } from 'leaflet';

import type { IpLookupResponse } from '@/api/lookupIp';
import styles from '@/styles/IpDetailsModal.module.css'

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
  let location: LatLngExpression = [0, 0];

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

    location = [data.lat, data.lon];
  }

  const LocationMap = dynamic(() => import('@/components/LocationMap'), {
    ssr: false,
  });

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
                <Tbody>
                  {mappedEntries.map((el) => (
                    <Tr key={el.label + el.value}>
                      <Td pl={0}>{el.label}</Td>
                      <Td pr={0}>{el.value}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              <chakra.div className={styles.mapWrapper} my={4}>
                <LocationMap location={location} />
              </chakra.div>
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default IpDetailsModal;
