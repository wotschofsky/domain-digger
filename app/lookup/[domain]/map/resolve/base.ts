import CloudflareDoHResolver from '@/lib/resolvers/CloudflareDoHResolver';

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

  const lookup = new CloudflareDoHResolver();
  const records = await lookup.resolveRecordType(domain, 'A');

  return Response.json(records);
};
