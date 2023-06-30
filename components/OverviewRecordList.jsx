'use client';

import { useState } from 'react';
import { useDisclosure } from 'react-use-disclosure';

import IpDetailsModal from '@/components/IpDetailsModal';

const OverviewRecordList = ({ record }) => {
  const [detailedIp, setDetailedIp] = useState(null);
  const { isOpen, open, close } = useDisclosure();

  return (
    <>
      <span
        onClick={() => {
          setDetailedIp(record);
          open();
        }}
        className="cursor-pointer decoration-slate-700 decoration-dotted underline-offset-4 hover:underline dark:decoration-slate-300"
      >
        {record}
      </span>

      <IpDetailsModal ip={detailedIp} isOpen={isOpen} onClose={close} />
    </>
  );
};

export default OverviewRecordList;
