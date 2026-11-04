import { z } from 'zod';

const bootstrapSchema = z.object({
  services: z.array(z.tuple([z.array(z.string()), z.array(z.string())])),
});

const domainSchema = z.object({
  objectClassName: z.literal('domain'),
  ldhName: z.string(),
  events: z
    .array(z.object({ eventAction: z.string(), eventDate: z.string() }))
    .optional()
    .default([]),
  entities: z
    .array(
      z.object({
        roles: z.array(z.string()).optional().default([]),
        vcardArray: z
          .tuple([z.literal('vcard'), z.array(z.array(z.unknown()))])
          .optional(),
      }),
    )
    .optional()
    .default([]),
  secureDNS: z.object({ delegationSigned: z.boolean().optional() }).optional(),
});

export type RdapSummary =
  | { registered: false }
  | {
      registered: true;
      registrar: string | null;
      createdAt: string | null;
      dnssec: string | null;
    };

// One deadline spans bootstrap, registry request and body parsing.
// Trust boundary: only IANA-listed HTTPS services; never follow a response's links or redirects.
export const getRdapSummary = async (
  domain: string,
): Promise<RdapSummary | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);

  try {
    const bootstrapResponse = await fetch(
      'https://data.iana.org/rdap/dns.json',
      {
        signal: controller.signal,
        redirect: 'error',
        next: { revalidate: 86_400 },
      },
    );

    if (!bootstrapResponse.ok)
      throw new Error(`RDAP bootstrap HTTP ${bootstrapResponse.status}`);

    const bootstrap = bootstrapSchema.parse(await bootstrapResponse.json());

    const services = bootstrap.services
      .flatMap(([suffixes, urls]) =>
        suffixes
          .filter(
            (suffix) => domain === suffix || domain.endsWith(`.${suffix}`),
          )
          .map((suffix) => ({ suffix, urls })),
      )
      .toSorted((a, b) => b.suffix.length - a.suffix.length)[0];

    if (!services) return null;

    let lastError: unknown = new Error('No HTTPS RDAP service available');

    for (const service of services.urls.slice(0, 3)) {
      controller.signal.throwIfAborted();
      const base = new URL(service);

      if (base.protocol !== 'https:' || base.username || base.password)
        continue;

      try {
        const url = new URL(
          `domain/${encodeURIComponent(domain)}`,
          service.endsWith('/') ? service : `${service}/`,
        );

        const response = await fetch(url, {
          signal: controller.signal,
          redirect: 'error',
          headers: { Accept: 'application/rdap+json' },
          cache: 'no-store',
        });

        const body: unknown = await response.json();

        if (
          response.status === 404 &&
          z.object({ errorCode: z.literal(404) }).safeParse(body).success
        )
          return { registered: false };

        if (!response.ok)
          throw new Error(`RDAP registry HTTP ${response.status}`);

        const data = domainSchema.parse(body);

        if (data.ldhName.toLowerCase().replace(/\.$/, '') !== domain)
          throw new Error('RDAP response names a different domain');

        const registrarEntity = data.entities.find((entity) =>
          entity.roles.includes('registrar'),
        );

        const name = registrarEntity?.vcardArray?.[1].find(
          (property) => property[0] === 'fn',
        )?.[3];

        const registeredAt = data.events.find(
          (event) => event.eventAction === 'registration',
        )?.eventDate;

        const parsedDate = registeredAt ? new Date(registeredAt) : null;
        const signed = data.secureDNS?.delegationSigned;
        let dnssec: string | null = null;
        if (signed !== undefined) dnssec = signed ? 'signed' : 'unsigned';

        return {
          registered: true,
          registrar: typeof name === 'string' ? name : null,
          createdAt:
            parsedDate && !Number.isNaN(parsedDate.getTime())
              ? parsedDate.toISOString().slice(0, 10)
              : null,
          dnssec,
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
};
