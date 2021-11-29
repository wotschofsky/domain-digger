import { chakra, Flex, Spinner } from '@chakra-ui/react';
import { css } from '@emotion/react';
import useSWR from 'swr';

import type { WhoisLookupResponse } from '@/api/lookupWhois';

type IpDetailsModalProps = {
  domain: string;
};

const WhoisModal = (props: IpDetailsModalProps) => {
  const { data, error } = useSWR<WhoisLookupResponse>(
    `/api/lookupWhois?domain=${encodeURIComponent(props.domain)}`
  );

  return (
    <>
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
    </>
  );
};

export default WhoisModal;
