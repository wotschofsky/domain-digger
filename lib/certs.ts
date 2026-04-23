import { upstreamUserFacingError } from './user-facing-error';

export type CertsData = {
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  id: number;
  entry_timestamp: string;
  not_before: string;
  not_after: string;
  serial_number: string;
}[];

export const lookupCerts = async (domain: string): Promise<CertsData> => {
  let response: Response;
  try {
    response = await fetch(
      'https://crt.sh?' +
        new URLSearchParams({
          Identity: domain,
          output: 'json',
        }),
    );
  } catch {
    throw upstreamUserFacingError({ service: 'crt.sh' });
  }

  if (!response.ok) {
    throw upstreamUserFacingError({
      service: 'crt.sh',
      status: response.status,
    });
  }

  const data: CertsData = await response.json();

  return data.filter((cert) =>
    cert.name_value
      .split(/\n/g)
      .some((value) => value === domain || value.endsWith(`.${domain}`)),
  );
};

export const lookupRelatedCerts = async (domain: string) => {
  const requests = [lookupCerts(domain)];

  const hasParentDomain = domain.split('.').filter(Boolean).length > 2;
  if (hasParentDomain) {
    const parentDomain = domain.split('.').slice(1).join('.');
    requests.push(lookupCerts(`*.${parentDomain}`));
  }

  const responses = await Promise.all(requests);

  const certs = responses
    .flat()
    .toSorted(
      (a, b) =>
        new Date(b.entry_timestamp).getTime() -
        new Date(a.entry_timestamp).getTime(),
    );

  return certs;
};
