import dns from 'dns';
import type { NextApiRequest, NextApiResponse } from 'next';
import { promisify } from 'util';
import isIP from 'validator/lib/isIP';

export type IpLookupResponse = {
  city: string;
  country: string;
  isp: string;
  lat: number;
  lon: number;
  org: string;
  region: string;
  reverse: string[];
  timezone: string;
};

export type IpLookupErrorResponse = { error: true; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IpLookupResponse | IpLookupErrorResponse>
) {
  if (
    !req.query.ip ||
    typeof req.query.ip === 'object' ||
    !isIP(req.query.ip)
  ) {
    res.status(400).json({
      error: true,
      message: 'Bad Request',
    });
    return;
  }

  const url = `http://ip-api.com/json/${req.query.ip}`;
  const response = await fetch(url);
  const data = (await response.json()) as Record<string, any>;

  let reverse: string[] = [];
  try {
    reverse = await promisify(dns.reverse)(req.query.ip);
  } catch (error) {
    console.error(error);
  }

  res.json({
    reverse: reverse,
    isp: data.isp,
    org: data.org,
    country: data.country,
    region: data.regionName,
    city: data.city,
    timezone: data.timezone,
    lat: data.lat,
    lon: data.lon,
  });
}
