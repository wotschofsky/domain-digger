import CloudflareDoHResolver from '@/lib/resolvers/CloudflareDoHResolver';
import { RECORD_TYPES, RecordType } from '@/lib/resolvers/DnsResolver';

export const handler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const types = searchParams.getAll('type');
  const domain = searchParams.get('domain');

  if (!types.length || !domain) {
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

  for (const type of types) {
    // @ts-expect-error
    if (!RECORD_TYPES.includes(type)) {
      return Response.json(
        {
          error: true,
          message: `Invalid record type "${type}"`,
        },
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }

  const lookup = new CloudflareDoHResolver();
  const records = Object.fromEntries(
    await Promise.all(
      types.map(async (type) => [
        type,
        await lookup.resolveRecordType(domain, type as RecordType),
      ])
    )
  );

  return Response.json(records);
};
