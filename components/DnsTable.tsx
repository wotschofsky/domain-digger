import { Fragment } from 'react';
import { chakra, Heading, Table, Tbody, Th, Thead, Tr } from '@chakra-ui/react';
import { css } from '@emotion/react';

import { ResolvedRecords } from '@/utils/DnsLookup';
import RecordRow from '@/components/RecordRow';

type DnsTableProps = {
  records: ResolvedRecords;
};

const DnsTable = ({ records }: DnsTableProps) => (
  <>
    {Object.keys(records).map((recordType) => {
      const value = records[recordType];

      if (!value || value.length === 0) {
        return;
      }

      return (
        <Fragment key={recordType}>
          <Heading as="h2" fontSize={{ base: 'xl', sm: '2xl' }} mb={4} mt={8}>
            {recordType}
          </Heading>
          <chakra.div
            css={css`
              overflow-x: auto;
            `}
          >
            <Table key={recordType}>
              <Thead>
                <Tr>
                  <Th pl={0}>Name</Th>
                  <Th>TTL</Th>
                  <Th pr={0}>Value</Th>
                </Tr>
              </Thead>
              <Tbody>
                {value.map((v) => (
                  <RecordRow key={v.type + v.data} record={v} />
                ))}
              </Tbody>
            </Table>
          </chakra.div>
        </Fragment>
      );
    })}
  </>
);

export default DnsTable;
