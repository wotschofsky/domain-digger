import { ImageResponse } from 'next/og';

import { env } from '@/env';

export const runtime = 'edge';
export const contentType = 'image/png';

const interRegularFontP = fetch(
  new URL('https://fonts.bunny.net/inter/files/inter-latin-400-normal.woff'),
).then((res) => res.arrayBuffer());

const interBoldFontP = fetch(
  new URL('https://fonts.bunny.net/inter/files/inter-latin-700-normal.woff'),
).then((res) => res.arrayBuffer());

const publicUrl =
  env.SITE_URL ||
  (env.VERCEL_URL && `https://${env.VERCEL_URL}`) ||
  'http://localhost:3000';

type OGImageProps = {
  params: Promise<{
    domain: string;
  }>;
};

export const handler = async ({ params: paramsPromise }: OGImageProps) => {
  const params = await paramsPromise;

  const [interRegularFont, interBoldFont] = await Promise.all([
    interRegularFontP,
    interBoldFontP,
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          backgroundColor: '#fff',
          backgroundImage:
            'radial-gradient(circle at 25px 25px, rgba(0, 0, 0, 0.15) 5%, transparent 0%)',
          backgroundSize: '50px 50px',
          padding: 48,
          paddingBottom: 200,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <svg
            fillRule="evenodd"
            strokeLinejoin="round"
            strokeMiterlimit={2}
            clipRule="evenodd"
            viewBox="0 0 512 512"
            style={{ width: 80, height: 80 }}
          >
            <path
              fill="#231f20"
              d="M381.725 202.527a160.266 160.266 0 0 1-.847 20.03c1.596-14.005.766-22.945.766-22.945.032.977.065 1.938.081 2.915m26.3-.505c.097 19.542-2.328 37.211-6.497 53.105 4.625-17.132 6.839-34.964 6.497-53.105m-237.838-90.559h-15.502v26.3h15.502c83.036 0 153.109 61.686 165.892 141.611 5.309-8.516 9.673-17.636 13.11-27.326a146.083 146.083 0 0 0 3.696-12.099c-27.244-74.697-99.32-128.486-182.698-128.486"
              className="prefix__line"
            />
            <path
              fill="#231f20"
              d="M408.025 202.016c.098 19.542-2.328 37.21-6.497 53.104-.017.017-.017.049-.017.065a72.17 72.17 0 0 1-.683 2.493c-7.313 25.647-20.064 49.683-37.699 70.74a4.823 4.823 0 0 1-.066.472c-12.017 14.249-24.492 24.932-34.637 32.39.048-.114.081-.244.13-.358a200.658 200.658 0 0 1-21.757 13.972c-.064.033-.113.049-.129.065-.017.016-.033.016-.033.016a202.464 202.464 0 0 1-12.002 6.14 202.464 202.464 0 0 1-12.848 5.487c-22.734 8.827-47.031 13.517-71.604 13.517H165.27c-20.307 0-36.82 16.513-36.82 36.819 0 20.308 16.513 36.82 36.82 36.82h1.335c46.037 0 91.064-18.971 123.52-52.062a171.467 171.467 0 0 0 16.659-19.737l10.356-4.934c.864-.407 15.813-7.622 34.572-22.928-9.379 24.247-23.824 46.67-42.812 66.034-37.373 38.09-89.239 59.943-142.295 59.943h-1.335c-34.817 0-63.136-28.319-63.136-63.136 0-34.816 28.319-63.135 63.136-63.135h44.913c15.828 0 31.56-2.247 46.688-6.546a167.136 167.136 0 0 0 13.956-4.625 163.785 163.785 0 0 0 13.175-5.586c18.369-8.696 35.255-20.6 49.684-35.305 1.384-1.4 2.752-2.834 4.071-4.283 0-.098.016-.195.016-.293 10.829-11.676 19.004-23.824 25.192-35.696.017.082.017.146.034.228 9.021-17.197 14.916-35.778 17.375-55.026.065-.44.13-.879.179-1.303.098-.749.196-1.498.277-2.263a3.24 3.24 0 0 0 .049-.554c1.595-14.005.765-22.945.765-22.945a153.84 153.84 0 0 0-.929-12.344 156.216 156.216 0 0 0-1.856-12.425c-14.688-77.694-83.67-137.035-165.11-137.035H128.45l.049 49.228h-.049v67.972h.114l.18 203.673c.015 16.903-6.564 32.797-18.5 44.75-11.953 11.953-27.83 18.532-44.734 18.532-34.817 0-63.184-28.319-63.217-63.152L2 124.631a13.18 13.18 0 0 1 3.859-9.315 13.112 13.112 0 0 1 9.299-3.859h60.79v26.3H28.332l.26 221.015c.033 20.339 16.594 36.885 36.918 36.885 9.869 0 19.151-3.843 26.12-10.829 6.987-6.986 10.814-16.252 10.814-26.121l-.212-220.95h-.033v-26.3h.016l-.016-17.359V87.03l-.065-62.37a13.11 13.11 0 0 1 3.86-9.299 13.112 13.112 0 0 1 9.299-3.859h98.456c96.731 0 178.253 72.369 192.192 165.794a172.712 172.712 0 0 1 1.433 12.393c.358 4.071.57 8.191.651 12.327"
              className="prefix__line"
            />
            <path
              fill="#1fb622"
              fillRule="nonzero"
              d="M446.499 399.307c-20.752 0-37.637 16.888-37.637 37.64s16.885 37.634 37.637 37.634 37.638-16.882 37.638-37.634-16.886-37.64-37.638-37.64m0 100.772c-34.813 0-63.136-28.322-63.136-63.132 0-34.817 28.323-63.139 63.136-63.139s63.136 28.322 63.136 63.139c0 34.81-28.323 63.132-63.136 63.132"
            />
          </svg>
          <span
            style={{
              fontSize: 64,
              color: '#000',
              fontWeight: 700,
            }}
          >
            Domain Digger
          </span>
        </div>

        <span
          style={{
            color: 'gray',
            fontSize: 32,
            marginTop: 48,
          }}
        >
          Full Domain Analysis Results for
        </span>

        <div
          style={{
            borderWidth: 3,
            borderColor: 'rgba(0, 0, 0, 0.25)',
            borderStyle: 'solid',
            width: '65%',
            height: 64,
            borderRadius: 12,
            backgroundColor: '#fff',
            display: 'flex',
            textAlign: 'center',
            padding: 16,
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
          }}
        >
          <div
            style={{
              color: 'rgba(0, 0, 0, 0.8)',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {params.domain}
          </div>

          {/* Lucide Search Icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0, 0, 0, 0.4)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ height: 40, width: 40 }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        <span
          style={{
            color: 'gray',
            fontSize: 32,
            fontWeight: 'bold',
            marginTop: 12,
            display: 'flex',
            gap: 32,
          }}
        >
          <span>DNS ✅</span>
          <span>WHOIS ✅</span>
          <span>IPs ✅</span>
          <span>SSL Certs ✅</span>
        </span>

        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          // TODO Include image in bundle
          src={`${publicUrl}/assets/globe.png`}
          width={1000}
          style={{
            position: 'absolute',
            left: 100,
            bottom: -750,
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      emoji: 'twemoji',
      fonts: [
        {
          name: 'Inter',
          data: interRegularFont,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'Inter',
          data: interBoldFont,
          style: 'normal',
          weight: 700,
        },
      ],
    },
  );
};

export default handler;
