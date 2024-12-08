import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { AuthorSection } from '../_components/author-section';
import { SponsorsSection } from '../_components/sponsors-section';
import { TrustSection } from '../_components/trust-section';

export const revalidate = 86400; // 24 hours

export const metadata = {
  openGraph: {
    url: '/certs',
  },
  alternates: {
    canonical: '/certs',
  },
};

const CertsLandingPage: FC = () => (
  <div className="container space-y-16">
    <div className="flex min-h-[calc(100vh-4.5rem-2rem)] flex-col justify-between gap-16 pb-12">
      <div className="flex min-h-[40vh] flex-col justify-center py-24">
        <section>
          <h1 className="mb-16 scroll-m-20 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Find certificate history for any domain
          </h1>
          <div className="mx-auto w-full max-w-2xl">
            <SearchForm autofocus />
          </div>
          <p className="mb-20 mt-4 text-center text-sm/6 text-zinc-500 dark:text-zinc-400">
            Find all DNS records, WHOIS data, SSL/TLS certificate history,
            subdomains and more
          </p>
        </section>
        <SponsorsSection />
      </div>

      <AuthorSection />

      <TrustSection subpage="certs" />
    </div>

    <div className="mx-auto max-w-4xl space-y-4 pt-16 text-center">
      <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        About Certificate Logs
      </h2>
      <p>
        Certificate Transparency (CT) logs are public records that track the
        issuance of SSL/TLS certificates, providing a transparent and verifiable
        system for monitoring certificates issued by Certificate Authorities
        (CAs). These logs are append-only and publicly accessible, allowing
        anyone to audit and review certificates issued for domains. By
        referencing CT logs, administrators can verify that no unauthorized or
        misissued certificates have been generated for their domains, ensuring
        the integrity of their SSL/TLS implementations.
      </p>
      <p>
        From a technical perspective, Certificate Transparency logs are crucial
        for improving security by detecting certificate misissuance and
        potential attacks such as man-in-the-middle. By integrating CT log
        monitoring, domain owners can receive real-time alerts when a new
        certificate is issued for their domain, allowing them to respond quickly
        to any anomalies. CT logs also enhance trust across the web by providing
        an open system that anyone can query to audit certificate issuance. This
        mechanism is critical for maintaining a secure web environment and
        ensuring SSL/TLS certificates are properly issued and managed.
      </p>
    </div>
  </div>
);

export default CertsLandingPage;
