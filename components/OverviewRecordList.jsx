'use client';

import IpLink from '@/components/IpLink';

const OverviewRecordList = ({ record }) => {
  return (
    <>
      <IpLink value={record} />
    </>
  );
};

export default OverviewRecordList;
