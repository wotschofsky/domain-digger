import type { FC } from 'react';

import { getPageMetadata } from '@/lib/page-metadata';

import { FeaturesSection } from './_components/features-section';
import { LandingPage } from './_components/landing-page';

export const metadata = getPageMetadata({ url: '/' });

const MainLandingPage: FC = () => (
  <LandingPage heading="Get details about any Domain">
    <FeaturesSection className="mt-32!" />
  </LandingPage>
);

export default MainLandingPage;
