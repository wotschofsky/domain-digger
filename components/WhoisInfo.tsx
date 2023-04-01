import { chakra, Flex, Heading, Spinner } from '@chakra-ui/react';
import { css } from '@emotion/react';
import { Fragment } from 'react';
import useSWR from 'swr';

import type { WhoisLookupResponse } from '@/api/lookupWhois';

type IpDetailsModalProps = {
  domain: string;
};

const WhoisModal = (props: IpDetailsModalProps) => {
  const { data, error } = useSWR<WhoisLookupResponse>(
    `/api/lookupWhois?domain=${encodeURIComponent(props.domain)}`
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

  return (
    <>
      {Object.keys(data).map((key) => (
        <Fragment key={key}>
          <Heading mt={8} mb={4}>
            {key}
          </Heading>
          <chakra.code
            css={css`
              white-space: pre-wrap;
            `}
          >
            {data[key]}
          </chakra.code>
        </Fragment>
      ))}
    </>
  );
};

export default WhoisModal;
