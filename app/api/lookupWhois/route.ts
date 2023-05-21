import isValidDomain from 'is-valid-domain';
import whoiser, { type WhoisSearchResult } from 'whoiser';

export type WhoisLookupResponse = {
  [domainName: string]: string;
};

export type WhoisLookupErrorResponse = { error: true; message: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain || !isValidDomain(domain)) {
    return new Response(
      JSON.stringify({
        error: true,
        message: '"domain" param missing or invalid',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const result = await whoiser(domain, {
    raw: true,
    timeout: 3000,
  });

  const mappedResults: Record<string, string> = {};
  for (const key in result) {
    mappedResults[key] = (result[key] as WhoisSearchResult).__raw as string;
  }

  return new Response(JSON.stringify(mappedResults), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
