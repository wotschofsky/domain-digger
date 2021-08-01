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
} from '@chakra-ui/react';
import { css } from '@emotion/react';
import useSWR from 'swr';

import type { WhoisLookupResponse } from '@/api/lookupWhois';

type IpDetailsModalProps = {
  domain: string;
  isOpen: boolean;
  onClose: () => void;
};

const WhoisModal = (props: IpDetailsModalProps) => {
  const { data, error } = useSWR<WhoisLookupResponse>(
    props.isOpen
      ? `/api/lookupWhois?domain=${encodeURIComponent(props.domain)}`
      : null
  );

  return (
    <Modal size="xl" isOpen={props.isOpen} onClose={props.onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Whois Data for {props.domain}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!data ? (
            <Flex justify="center" align="center">
              <Spinner size="xl" my={8} />
            </Flex>
          ) : error ? (
            <p>An error occurred!</p>
          ) : (
            <chakra.code
              css={css`
                white-space: pre-wrap;
              `}
            >
              {data.data}
            </chakra.code>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default WhoisModal;
