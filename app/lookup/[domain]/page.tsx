import LookupPageContent from '@/components/LookupPageContent';
import DnsLookup from '@/utils/DnsLookup';

const LookupDomain = async ({
  params: { domain },
}: {
  params: { domain: string };
}) => {
  const records = await DnsLookup.resolveAllRecords(domain);

  return (
    <>
      <title>{`Results for ${domain} - Domain Digger`}</title>

      {/* Temporary workaround until Chakra hopefully supports server components */}
      <LookupPageContent domain={domain} records={records} />
    </>
  );
};

export default LookupDomain;
