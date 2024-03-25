import Image from 'next/image';
import Link from 'next/link';
import Balancer from 'react-wrap-balancer';

import { Card } from '@/components/ui/card';

import LogoDark from '@/assets/logo-dark.svg';
import LogoLight from '@/assets/logo-light.svg';
import { EXAMPLE_DOMAINS } from '@/lib/data';

import { SearchForm } from '../_components/search-form';
import { TrustedByLogos } from './_components/trusted-by-logos';

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
      <section className="py-24 sm:py-32">
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <LogoDark className="inline h-12 dark:hidden sm:h-20" />
          <LogoLight className="hidden h-12 dark:inline sm:h-20" />
          <span className="text-4xl font-bold sm:text-6xl">Domain Digger</span>
        </div>

        <div className="my-16">
          <h1 className="mb-8 scroll-m-20 pb-2 text-center text-2xl font-semibold tracking-tight first:mt-0 sm:text-3xl">
            Get details about any Domain
          </h1>
          <div className="mx-auto max-w-4xl">
            <SearchForm autofocus={true} />
          </div>
        </div>

        <div>
          <h2 className="text-center font-semibold sm:text-lg">
            Start with examples
          </h2>
          <div className="mt-2 text-center text-sm leading-7 text-muted-foreground">
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
      </section>

      <section className="flex items-center justify-center gap-4 pb-16 font-medium sm:pb-24">
        <Image
          width={48}
          height={48}
          className="h-12 w-12 rounded-full"
          src="https://static.wsky.dev/branding/photo.jpg"
          alt="Felix Wotschofsky, creator of Domain Digger"
        />
        <div>
          <p>Hey there, I am Felix, the creator of Domain Digger. 👋</p>
          <p>
            You can{' '}
            <a
              className="underline decoration-dotted underline-offset-4"
              href="https://twitter.com/wotschofsky"
              target="_blank"
            >
              follow me on X
            </a>{' '}
            and{' '}
            <a
              className="underline decoration-dotted underline-offset-4"
              href="https://wotschofsky.com/"
              target="_blank"
            >
              check out my other projects
            </a>
            .
          </p>
        </div>
      </section>

      <section>
        <div className="flex flex-col items-center gap-8">
          <h2 className="text-center font-semibold sm:text-lg">
            Trusted by experts at
          </h2>

          <TrustedByLogos />

          <a
            href="https://www.producthunt.com/posts/domain-digger?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-domain&#0045;digger"
            target="_blank"
            className="mt-4"
          >
            <img
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=434616&theme=neutral"
              alt="Domain&#0032;Digger - Full&#0032;open&#0045;source&#0032;toolkit&#0032;for&#0032;next&#0045;level&#0032;domain&#0032;analysis | Product Hunt"
              style={{ width: '250px', height: '54px' }}
              width="250"
              height="54"
            />
          </a>
        </div>
      </section>

      <section className="mt-32">
        <h2 className="mb-6 text-center text-3xl font-bold">
          Domain Digger: The Essential Domain Information Tool
        </h2>

        <div className="mb-24 grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-2 text-xl font-semibold">
              A Comprehensive, Web-Based DNS Client
            </h3>
            <p>
              Domain Digger is an advanced, web-based tool designed to provide
              detailed insights into domain-related data. It serves as a
              versatile DNS client, offering functionalities similar to
              command-line tools like dig and nslookup, but with the added
              convenience of a user-friendly web interface. This tool is
              indispensable for anyone needing in-depth information about domain
              names, making it a valuable resource for digital marketers, SEO
              experts, and web developers.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-xl font-semibold">
              Efficient and Accurate DNS Record Analysis
            </h3>
            <p>
              Our tool excels in delivering an extensive overview of DNS records
              for any given domain name. It&apos;s designed to present all
              relevant DNS records of a website in a clear, easy-to-understand
              format. Unlike traditional tools that may cache DNS responses,
              Domain Digger ensures the most current information by querying DNS
              servers for fresh records.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-xl font-semibold">
              Simplified Process, Enhanced Capabilities
            </h3>
            <p>
              Using Domain Digger is straightforward. Simply enter a domain
              name, and you&apos;re instantly taken to a comprehensive overview
              of its DNS records. Behind the scenes, our tool queries a DNS
              server without caching results, ensuring you receive the most
              up-to-date information.
            </p>
          </Card>

          <Card className="p-4">
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
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-xl font-semibold">
              Extensive Support for Active DNS Record Types
            </h3>
            <p>
              Our platform supports a broad spectrum of DNS record types known
              to be in active use, including but not limited to: A and AAAA for
              IP addresses, CNAME for canonical names, MX for mail exchanges, NS
              for name servers, SOA for start of authority, SRV for service
              locators, TXT for human-readable text, and many more.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-xl font-semibold">
              Practical Applications and Use Cases
            </h3>
            <p>
              Domain Digger is useful in various scenarios, such as verifying
              the correct configuration of DNS records for your domain or
              monitoring the propagation of DNS record changes across the domain
              name system. Its ability to display multiple record types
              simultaneously and the option to share results make it superior to
              traditional command-line interfaces for DNS lookup tasks.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Home;
