import type { NextApiRequest, NextApiResponse } from 'next';
import { promisify } from 'util';
import axios from 'axios';
import dns from 'dns';
import isIP from 'validator/lib/isIP';

export type IpLookupResponse = {
  reverse: string[];
  isp: string;
  org: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  lat: string;
  lon: string;
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
  const response = await axios(url);

  let reverse: string[] = [];
  try {
    reverse = await promisify(dns.reverse)(req.query.ip);
  } catch (error) {
    console.error(error);
  }

  res.json({
    reverse: reverse,
    isp: response.data.isp,
    org: response.data.org,
    country: response.data.country,
    region: response.data.regionName,
    city: response.data.city,
    timezone: response.data.timezone,
    lat: response.data.lat,
    lon: response.data.lon,
  });
}
