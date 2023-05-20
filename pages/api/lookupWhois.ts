import isValidDomain from 'is-valid-domain';
import type { NextApiRequest, NextApiResponse } from 'next';
import whoiser, { type WhoisSearchResult } from 'whoiser';

export type WhoisLookupResponse = {
  [domainName: string]: string;
};

export type WhoisLookupErrorResponse = { error: true; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WhoisLookupResponse | WhoisLookupErrorResponse>
) {
  if (
    !req.query.domain ||
    typeof req.query.domain === 'object' ||
    !isValidDomain(req.query.domain)
  ) {
    res.status(400).json({
      error: true,
      message: 'Bad Request',
    });
    return;
  }

  const result = await whoiser(req.query.domain, { raw: true, timeout: 3000 });

  const mappedResults: Record<string, string> = {};
  for (const key in result) {
    mappedResults[key] = (result[key] as WhoisSearchResult).__raw as string;
  }

  res.json(mappedResults);
}
