import whoiser from 'whoiser';

import { Badge } from '@/components/ui/badge';

export default async function OverviewDomainlabel({ domain }) {
  const whoisResult = whoiser.firstResult(
    await whoiser(domain, {
      timeout: 3000,
    })
  );

  return (
    <>
      {Object.values(whoisResult['Domain Status']).map((label) => {
        return (
          <a
            className={`mx-1 my-2 ${
              label.split(' ')[1] ? 'cursor-pointer' : 'cursor-text'
            }`}
            href={label.split(' ')[1]}
            target="_blank"
            rel="noreferrer"
          >
            <Badge variant="outline">{label.split(' ')[0]}</Badge>
          </a>
        );
      })}
    </>
  );
}
