import type { FC, HTMLAttributes } from 'react';

import { Card } from '@/components/ui/card';

type FeaturesSectionProps = HTMLAttributes<HTMLElement>;

export const FeaturesSection: FC<FeaturesSectionProps> = (props) => (
  <section {...props}>
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
          detailed insights into domain-related data. It serves as a versatile
          DNS client, offering functionalities similar to command-line tools
          like dig and nslookup, but with the added convenience of a
          user-friendly web interface. This tool is indispensable for anyone
          needing in-depth information about domain names, making it a valuable
          resource for digital marketers, SEO experts, and web developers.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-xl font-semibold">
          Efficient and Accurate DNS Record Analysis
        </h3>
        <p>
          Our tool excels in delivering an extensive overview of DNS records for
          any given domain name. It&apos;s designed to present all relevant DNS
          records of a website in a clear, easy-to-understand format. Unlike
          traditional tools that may cache DNS responses, Domain Digger ensures
          the most current information by querying DNS servers for fresh
          records.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-xl font-semibold">
          Simplified Process, Enhanced Capabilities
        </h3>
        <p>
          Using Domain Digger is straightforward. Simply enter a domain name,
          and you&apos;re instantly taken to a comprehensive overview of its DNS
          records. Behind the scenes, our tool queries a DNS server without
          caching results, ensuring you receive the most up-to-date information.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-xl font-semibold">
          Choice of DNS Servers and Record Types
        </h3>
        <p>
          Domain Digger offers the flexibility to select from a wide range of
          DNS servers, including popular public DNS servers, authoritative
          servers for the domain in question, and local servers worldwide. By
          default, it displays standard records like A, AAAA, CNAME, TXT, NS,
          MX, and SOA, but users can also opt to view additional types.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-xl font-semibold">
          Extensive Support for Active DNS Record Types
        </h3>
        <p>
          Our platform supports a broad spectrum of DNS record types known to be
          in active use, including but not limited to: A and AAAA for IP
          addresses, CNAME for canonical names, MX for mail exchanges, NS for
          name servers, SOA for start of authority, SRV for service locators,
          TXT for human-readable text, and many more.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="text-xl font-semibold">
          Practical Applications and Use Cases
        </h3>
        <p>
          Domain Digger is useful in various scenarios, such as verifying the
          correct configuration of DNS records for your domain or monitoring the
          propagation of DNS record changes across the domain name system. Its
          ability to display multiple record types simultaneously and the option
          to share results make it superior to traditional command-line
          interfaces for DNS lookup tasks.
        </p>
      </Card>
    </div>
  </section>
);
