import * as React from 'react';
import { CheckIcon, XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export default async function OverviewSecurity({ domain }) {
  let returnValue = [];

  async function getRobotsTXTData(domain) {
    let robotsTXTcheck = await fetch(
      `${
        process.env.BASE_URL
      }/api/scan/?domain=${domain}&file=${encodeURIComponent('robots.txt')}`,
      { next: { revalidate: 20 } }
    );
    return await robotsTXTcheck.json();
  }

  async function getSecurityTXTData(domain) {
    let securityTXTcheck = await fetch(
      `${
        process.env.BASE_URL
      }/api/scan/?domain=${domain}&file=${encodeURIComponent('security.txt')}`,
      { next: { revalidate: 20 } }
    );
    return await securityTXTcheck.json();
  }

  async function getHSTSState(domain) {
    let hstsCheck = await fetch(
      `${
        process.env.BASE_URL
      }/api/scan/?domain=${domain}&file=${encodeURIComponent('robots.txt')}`,
      { next: { revalidate: 20 } }
    );
    return await hstsCheck.json();
  }

  const robotsData = await getRobotsTXTData(domain);
  const securityData = await getSecurityTXTData(domain);
  const hstsData = await getHSTSState(domain);

  if (robotsData.fileResponse == 200) {
    returnValue.push(
      <a
        href={'https://' + robotsData.domain + '/' + robotsData.file}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer"
      >
        <Badge variant="outline">
          <CheckIcon
            className="mr-1 h-3.5 w-3.5 text-green-400"
            aria-hidden="true"
          />
          robots.txt
        </Badge>
      </a>
    );
  } else {
    returnValue.push(
      <Badge variant="outline">
        <XIcon className="mr-1 h-3.5 w-3.5 text-red-400" aria-hidden="true" />
        robots.txt
      </Badge>
    );
  }

  if (securityData.fileResponse == 200) {
    returnValue.push(
      <a
        href={'https://' + securityData.domain + '/' + securityData.file}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer"
      >
        <Badge variant="outline">
          <CheckIcon
            className="mr-1 h-3.5 w-3.5 text-green-400"
            aria-hidden="true"
          />
          security.txt
        </Badge>
      </a>
    );
  } else {
    returnValue.push(
      <Badge variant="outline">
        <XIcon className="mr-1 h-3.5 w-3.5 text-red-400" aria-hidden="true" />
        security.txt
      </Badge>
    );
  }

  if (hstsData != 'false') {
    returnValue.push(
      <Badge variant="outline">
        <CheckIcon
          className="mr-1 h-3.5 w-3.5 text-green-400"
          aria-hidden="true"
        />
        HSTS
      </Badge>
    );
  } else {
    returnValue.push(
      <Badge variant="outline">
        <XIcon className="mr-1 h-3.5 w-3.5 text-red-400" aria-hidden="true" />
        HSTS
      </Badge>
    );
  }

  return (
    <div>
      {returnValue.map((element, index) => (
        <React.Fragment key={index}>
          <span className="mx-1 my-2">{element}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
