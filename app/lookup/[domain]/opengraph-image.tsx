import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';

const interRegularFontP = fetch(
  new URL('https://fonts.bunny.net/inter/files/inter-latin-400-normal.woff')
).then((res) => res.arrayBuffer());

const interBoldFontP = fetch(
  new URL('https://fonts.bunny.net/inter/files/inter-latin-700-normal.woff')
).then((res) => res.arrayBuffer());

export const handler = async ({ params }: { params: { domain: string } }) => {
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
          gap: 16,
          backgroundColor: '#fff',
          padding: 48,
        }}
      >
        <span
          style={{
            fontSize: 32,
            color: '#000',
          }}
        >
          digga
        </span>
        <span style={{ fontSize: 48, fontWeight: 700 }}>
          Results for {params.domain}
        </span>
        <span
          style={{
            color: 'gray',
            fontSize: 32,
            marginTop: 32,
          }}
        >
          DNS records, WHOIS data, SSL/TLS certificates & more
        </span>
      </div>
    ),
    {
      width: 1200,
      height: 630,
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
    }
  );
};

export default handler;
