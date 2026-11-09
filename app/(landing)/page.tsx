import type { FC } from 'react';

import { getLandingHref, getPageMetadata } from '@/lib/lookup-features';

import { FeaturesSection } from './_components/features-section';
import { LandingPage } from './_components/landing-page';

export const metadata = getPageMetadata(getLandingHref('dns'));

const MainLandingPage: FC = () => (
  <LandingPage feature="dns" heading="Get details about any Domain">
    <FeaturesSection className="mt-32!" />
  </LandingPage>
);

export default MainLandingPage;
