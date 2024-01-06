export const handler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const domain = searchParams.get('domain');

  if (!type || !domain) {
    return Response.json(
      {
        error: true,
        message: '"type" and "domain" params are required',
      },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${domain}&type=${type}`,
    {
      headers: { Accept: 'application/dns-json' },
    }
  );
  const results = await response.json();

  return Response.json(results.Answer.map((a: { data: string }) => a.data));
};
