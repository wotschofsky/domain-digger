import {
  Globe,
  History,
  Layers,
  Link2,
  Network,
  ScrollText,
} from 'lucide-react';
import type { FC, HTMLAttributes } from 'react';

type FeaturesSectionProps = HTMLAttributes<HTMLElement>;

export const FeaturesSection: FC<FeaturesSectionProps> = (props) => (
  <section {...props}>
    <div className="mb-12">
      <h2 className="max-w-[35ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Everything <code>dig</code>, <code>whois</code>, and <code>crt.sh</code>{' '}
        give you — in one tab.
      </h2>
      <p className="mt-4 max-w-[60ch] text-pretty text-zinc-600 dark:text-zinc-400">
        Live, uncached, and shareable. No install. No accounts. Just paste a
        domain.
      </p>
    </div>

    <dl className="mb-24 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <dt className="flex items-center gap-3">
          <Globe className="size-5 text-zinc-500 dark:text-zinc-400" />
          <span className="text-base font-semibold tracking-tight">
            Live DNS lookups
          </span>
        </dt>
        <dd className="mt-2 text-pretty text-zinc-600 dark:text-zinc-400">
          Every lookup runs in real time. We never cache results between
          requests.
        </dd>
      </div>

      <div>
        <dt className="flex items-center gap-3">
          <Layers className="size-5 text-zinc-500 dark:text-zinc-400" />
          <span className="text-base font-semibold tracking-tight">
            Every record type
          </span>
        </dt>
        <dd className="mt-2 text-pretty text-zinc-600 dark:text-zinc-400">
          A, AAAA, CNAME, MX, TXT, NS, SOA, CAA, SRV — and the obscure ones too.
        </dd>
      </div>

      <div>
        <dt className="flex items-center gap-3">
          <Network className="size-5 text-zinc-500 dark:text-zinc-400" />
          <span className="text-base font-semibold tracking-tight">
            Worldwide resolvers
          </span>
        </dt>
        <dd className="mt-2 text-pretty text-zinc-600 dark:text-zinc-400">
          Compare answers from Cloudflare, Google, your ISP, or the
          authoritative servers — across regions around the world.
        </dd>
      </div>

      <div>
        <dt className="flex items-center gap-3">
          <ScrollText className="size-5 text-zinc-500 dark:text-zinc-400" />
          <span className="text-base font-semibold tracking-tight">
            WHOIS, decoded
          </span>
        </dt>
        <dd className="mt-2 text-pretty text-zinc-600 dark:text-zinc-400">
          Registration, expiry, and ownership at a glance — no raw output to
          parse.
        </dd>
      </div>

      <div>
        <dt className="flex items-center gap-3">
          <Link2 className="size-5 text-zinc-500 dark:text-zinc-400" />
          <span className="text-base font-semibold tracking-tight">
            Subdomain discovery
          </span>
        </dt>
        <dd className="mt-2 text-pretty text-zinc-600 dark:text-zinc-400">
          Surface subdomains you didn&apos;t know existed. Built for security
          audits, recon, and attack-surface mapping.
        </dd>
      </div>

      <div>
        <dt className="flex items-center gap-3">
          <History className="size-5 text-zinc-500 dark:text-zinc-400" />
          <span className="text-base font-semibold tracking-tight">
            Certificate history
          </span>
        </dt>
        <dd className="mt-2 text-pretty text-zinc-600 dark:text-zinc-400">
          Every SSL/TLS certificate ever issued for a domain, with issuer and
          validity dates.
        </dd>
      </div>
    </dl>
  </section>
);
