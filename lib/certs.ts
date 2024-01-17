type CertsData = {
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
  const response = await fetch(
    'https://crt.sh?' +
      new URLSearchParams({
        Identity: domain,
        output: 'json',
      })
  );

  if (!response.ok) {
    throw new Error('Failed to fetch certs');
  }

  return await response.json();
};
