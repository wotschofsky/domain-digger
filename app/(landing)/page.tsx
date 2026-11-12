import type { FC } from 'react';

import { getLandingHref } from '@/lib/lookup-features';
import { getPageMetadata } from '@/lib/page-metadata';

import { FeaturesSection } from './_components/features-section';
import { LandingPage } from './_components/landing-page';

export const metadata = getPageMetadata({ url: getLandingHref('dns') });

const MainLandingPage: FC = () => (
  <LandingPage feature="dns" heading="Get details about any Domain">
    <FeaturesSection className="mt-32!" />
  </LandingPage>
);

export default MainLandingPage;
