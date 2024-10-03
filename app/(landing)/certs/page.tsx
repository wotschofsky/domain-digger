import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { SponsorsSection } from '../_components/sponsors-section';
import { AuthorSection } from './../_components/author-section';
import { TrustedBySection } from './../_components/trusted-by-section';

export const metadata = {
  openGraph: {
    url: '/certs',
  },
  alternates: {
    canonical: '/certs',
  },
};

const CertsLandingPage: FC = () => {
  return (
    <div className="container space-y-16 pt-24">
      <section>
        <h1 className="mb-8 scroll-m-20 pb-2 text-center text-2xl font-semibold tracking-tight first:mt-0 sm:text-3xl">
          Find certificate history for any domain
        </h1>
        <div className="mx-auto max-w-4xl">
          <SearchForm subpage="certs" autofocus />
        </div>
      </section>

      <TrustedBySection subpage="certs" />
      <AuthorSection />
      <SponsorsSection />

      <div className="mx-auto max-w-4xl space-y-4 pt-16 text-center">
        <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          About Certificate Logs
        </h2>
        <p>
          Certificate Transparency (CT) logs are public records that track the
          issuance of SSL/TLS certificates, providing a transparent and
          verifiable system for monitoring certificates issued by Certificate
          Authorities (CAs). These logs are append-only and publicly accessible,
          allowing anyone to audit and review certificates issued for domains.
          By referencing CT logs, administrators can verify that no unauthorized
          or misissued certificates have been generated for their domains,
          ensuring the integrity of their SSL/TLS implementations.
        </p>
        <p>
          From a technical perspective, Certificate Transparency logs are
          crucial for improving security by detecting certificate misissuance
          and potential attacks such as man-in-the-middle. By integrating CT log
          monitoring, domain owners can receive real-time alerts when a new
          certificate is issued for their domain, allowing them to respond
          quickly to any anomalies. CT logs also enhance trust across the web by
          providing an open system that anyone can query to audit certificate
          issuance. This mechanism is critical for maintaining a secure web
          environment and ensuring SSL/TLS certificates are properly issued and
          managed.
        </p>
      </div>
    </div>
  );
};

export default CertsLandingPage;
