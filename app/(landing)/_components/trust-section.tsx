import type { FC, HTMLAttributes } from 'react';

import { Testimonial } from './testimonial';
import { TrustedByLogos } from './trusted-by-logos';

type TrustSectionProps = HTMLAttributes<HTMLElement> & {
  subpage?: string;
};

export const TrustSection: FC<TrustSectionProps> = (props) => (
  <section {...props}>
    <div className="flex flex-col items-center gap-5">
      <h2 className="text-center font-semibold">Trusted by experts at</h2>
      <TrustedByLogos subpage={props.subpage} />
    </div>

    <div className="mt-12 grid grid-cols-3 gap-8">
      <Testimonial
        from={{
          url: 'https://www.linkedin.com/in/anouar-springer',
          name: 'Anouar Springer',
          role: 'Growth @ Superchat',
          imgSrc: '/assets/testimonials/anouar-springer.jpg',
        }}
      >
        <strong>
          Domain Digger has been a great help in improving our email
          deliverability.
        </strong>{' '}
        It&apos;s made checking our domain settings straightforward, providing
        detailed information that was easy to understand and use. I&apos;d
        recommend it to anyone looking to optimize their domain performance.
      </Testimonial>

      <Testimonial
        from={{
          url: 'https://www.linkedin.com/in/boguslawski',
          name: 'Samuel Boguslawski',
          role: 'Lecturer @ CODE University',
          imgSrc: '/assets/testimonials/samuel-boguslawski.jpg',
        }}
      >
        As a software engineering lecturer, I use Domain Digger in my classes to{' '}
        <strong>help students understand how the internet works.</strong> The
        different interactive elements and maps help visualize various concepts
        and provide a fun way for students to learn about DNS interactively.
      </Testimonial>

      <Testimonial
        from={{
          url: 'https://x.com/genuinu',
          name: 'benj',
          role: 'Domain Reseller',
          imgSrc: '/assets/testimonials/genuinu.png',
        }}
      >
        If you&apos;re not using Domain Digger then it&apos;s something else and
        that&apos;s just silly.
        <br />
        <br />
        It even looks up emojis!
      </Testimonial>
    </div>
  </section>
);
