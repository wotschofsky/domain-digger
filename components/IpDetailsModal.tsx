import { ExternalLinkIcon } from '@chakra-ui/icons';
import {
  chakra,
  Flex,
  IconButton,
  Link,
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
  Tooltip,
  Tr,
} from '@chakra-ui/react';
import { css } from '@emotion/react';
import type { LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import useSWR from 'swr';

import type { IpLookupResponse } from '@/api/lookupIp';

enum EntryTypes {
  IP,
  Reverse,
  Organization,
  ISP,
  Location,
  Coordinates,
  Timezone,
}

type IpDetailsModalProps = {
  ip: string;
  isOpen: boolean;
  onClose: () => void;
};

const IpDetailsModal = (props: IpDetailsModalProps) => {
  const { data, error } = useSWR<IpLookupResponse>(
    props.isOpen ? `/api/lookupIp?ip=${encodeURIComponent(props.ip)}` : null
  );

  let mappedEntries: { label: string; value: string; type: EntryTypes }[] = [];
  let location: LatLngExpression = [0, 0];

  if (data) {
    mappedEntries = [
      {
        type: EntryTypes.IP,
        label: 'IP',
        value: props.ip,
      },
      ...data.reverse.map((address) => ({
        type: EntryTypes.Reverse,
        label: 'Reverse',
        value: address,
      })),
      {
        type: EntryTypes.Organization,
        label: 'Organization',
        value: data.org,
      },
      {
        type: EntryTypes.ISP,
        label: 'ISP',
        value: data.isp,
      },
      {
        type: EntryTypes.Location,
        label: 'Location',
        value: `${data.country}, ${data.region}, ${data.city}`,
      },
      {
        type: EntryTypes.Coordinates,
        label: 'Coordinates',
        value: `Latitude: ${data.lat}; Longitude: ${data.lon}`,
      },
      {
        type: EntryTypes.Timezone,
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
                      <Td pr={0}>
                        <>
                          <span>{el.value}</span>{' '}
                          {el.type === EntryTypes.Reverse && (
                            <Tooltip label="View Domain Records">
                              <NextLink
                                href={`/lookup/${el.value}`}
                                passHref
                                legacyBehavior
                              >
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
                          )}
                        </>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              <chakra.div
                css={css`
                  .leaflet-container {
                    width: 100%;
                    height: 20rem;
                  }
                `}
                my={4}
              >
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
