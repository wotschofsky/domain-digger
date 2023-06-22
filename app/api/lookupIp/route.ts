import dns from 'dns';
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
  greenHosted: boolean;
};

export type IpLookupErrorResponse = { error: true; message: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');

  if (!ip || !isIP(ip)) {
    return new Response(
      JSON.stringify({
        error: true,
        message: '"ip" param missing or invalid',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const url = `http://ip-api.com/json/${ip}`;
  const response = await fetch(url);
  const data = (await response.json()) as Record<string, any>;

  let reverse: string[] = [];
  try {
    reverse = await promisify(dns.reverse)(ip);
  } catch (error) {
    console.error(error);
  }

  //GREEN ENERGY CHECK
  const greenUrl = `https://api.thegreenwebfoundation.org/greencheck/${ip}`;
  const greenResponse = await fetch(greenUrl);
  const greenData = (await greenResponse.json()) as Record<string, any>;

  return new Response(
    JSON.stringify({
      reverse: reverse,
      isp: data.isp,
      org: data.org,
      country: data.country,
      region: data.regionName,
      city: data.city,
      timezone: data.timezone,
      lat: data.lat,
      lon: data.lon,
      greenHosted: greenData.green,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
