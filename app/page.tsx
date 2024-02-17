import Link from 'next/link';
import Balancer from 'react-wrap-balancer';

import SearchForm from '@/components/general/SearchForm';
import TrustedByLogos from '@/components/marketing/TrustedByLogos';
import { EXAMPLE_DOMAINS } from '@/lib/data';

export const metadata = {
  openGraph: {
    url: '/',
  },
  alternates: {
    canonical: '/',
  },
};

const Home = () => {
  return (
    <div className="container">
      <div className="flex min-h-[80vh] flex-col justify-center gap-36 py-24">
        <div className="lg:w-3/4 xl:w-1/2">
          <h1 className="mb-16 text-2xl font-semibold tracking-tight sm:text-5xl">
            Get details about any Domain
          </h1>
          <SearchForm textAlignment="left" autofocus={true} />
        </div>

        <div className="max-w-xl">
          <h2 className="mb-5 text-xl font-semibold tracking-tight sm:text-2xl">
            Or start with some examples
          </h2>

          <div className="mt-6 text-sm leading-7 text-muted-foreground">
            <Balancer>
              {EXAMPLE_DOMAINS.map((domain) => (
                <>
                  <Link
                    key={domain}
                    className="underline decoration-dotted underline-offset-4"
                    href={`/lookup/${domain}`}
                  >
                    {domain}
                  </Link>
                  <span className="whitespace-pre-wrap">{'  '}</span>
                </>
              ))}
            </Balancer>
          </div>
        </div>

        <div>
          <h2 className="mb-8 text-xl font-semibold tracking-tight sm:text-2xl">
            Trusted by experts at
          </h2>
          <TrustedByLogos />
        </div>
      </div>

      <div>
        <h2 className="mb-6 text-3xl font-bold">
          Domain Digger: The Essential Domain Information Tool
        </h2>

        <div className="relative mb-24 flex flex-col before:absolute before:bottom-0 before:left-5 before:top-0 before:w-0.5 before:bg-muted-foreground">
          <div className="relative mb-24 gap-4">
            <span className="absolute left-0 flex h-10 w-10 -translate-y-2 transform items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-lg font-bold text-muted-foreground shadow-md shadow-background">
              1
            </span>
            <div className="pl-14">
              <h3 className="mb-2 text-xl font-semibold">
                A Comprehensive, Web-Based DNS Client
              </h3>
              <p>
                Domain Digger is an advanced, web-based tool designed to provide
                detailed insights into domain-related data. It serves as a
                versatile DNS client, offering functionalities similar to
                command-line tools like dig and nslookup, but with the added
                convenience of a user-friendly web interface. This tool is
                indispensable for anyone needing in-depth information about
                domain names, making it a valuable resource for digital
                marketers, SEO experts, and web developers.
              </p>
            </div>
          </div>

          <div className="relative mb-24 gap-4">
            <span className="absolute left-0 flex h-10 w-10 -translate-y-2 transform items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-lg font-bold text-muted-foreground shadow-md shadow-background">
              2
            </span>
            <div className="pl-14">
              <h3 className="mb-2 text-xl font-semibold">
                Efficient and Accurate DNS Record Analysis
              </h3>
              <p>
                Our tool excels in delivering an extensive overview of DNS
                records for any given domain name. It&apos;s designed to present
                all relevant DNS records of a website in a clear,
                easy-to-understand format. Unlike traditional tools that may
                cache DNS responses, Domain Digger ensures the most current
                information by querying DNS servers for fresh records.
              </p>
            </div>
          </div>

          <div className="relative mb-24 gap-4">
            <span className="absolute left-0 flex h-10 w-10 -translate-y-2 transform items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-lg font-bold text-muted-foreground shadow-md shadow-background">
              3
            </span>
            <div className="pl-14">
              <h3 className="mb-2 text-xl font-semibold">
                Simplified Process, Enhanced Capabilities
              </h3>
              <p>
                Using Domain Digger is straightforward. Simply enter a domain
                name, and you&apos;re instantly taken to a comprehensive
                overview of its DNS records. Behind the scenes, our tool queries
                a DNS server without caching results, ensuring you receive the
                most up-to-date information.
              </p>
            </div>
          </div>

          <div className="relative mb-24 gap-4">
            <span className="absolute left-0 flex h-10 w-10 -translate-y-2 transform items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-lg font-bold text-muted-foreground shadow-md shadow-background">
              4
            </span>
            <div className="pl-14">
              <h3 className="mb-2 text-xl font-semibold">
                Choice of DNS Servers and Record Types
              </h3>
              <p>
                Domain Digger offers the flexibility to select from a wide range
                of DNS servers, including popular public DNS servers,
                authoritative servers for the domain in question, and local
                servers worldwide. By default, it displays standard records like
                A, AAAA, CNAME, TXT, NS, MX, and SOA, but users can also opt to
                view additional types.
              </p>
            </div>
          </div>

          <div className="relative mb-24 gap-4">
            <span className="absolute left-0 flex h-10 w-10 -translate-y-2 transform items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-lg font-bold text-muted-foreground shadow-md shadow-background">
              5
            </span>
            <div className="pl-14">
              <h3 className="mb-2 text-xl font-semibold">
                Extensive Support for Active DNS Record Types
              </h3>
              <p>
                Our platform supports a broad spectrum of DNS record types known
                to be in active use, including but not limited to: A and AAAA
                for IP addresses, CNAME for canonical names, MX for mail
                exchanges, NS for name servers, SOA for start of authority, SRV
                for service locators, TXT for human-readable text, and many
                more.
              </p>
            </div>
          </div>

          <div className="relative gap-4">
            <span className="absolute left-0 flex h-10 w-10 -translate-y-2 transform items-center justify-center rounded-full border-2 border-muted-foreground bg-background text-lg font-bold text-muted-foreground shadow-md shadow-background">
              6
            </span>
            <div className="pl-14">
              <h3 className="text-xl font-semibold">
                Practical Applications and Use Cases
              </h3>
              <p>
                Domain Digger is useful in various scenarios, such as verifying
                the correct configuration of DNS records for your domain or
                monitoring the propagation of DNS record changes across the
                domain name system. Its ability to display multiple record types
                simultaneously and the option to share results make it superior
                to traditional command-line interfaces for DNS lookup tasks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
