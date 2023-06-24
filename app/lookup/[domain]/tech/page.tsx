import NoTechFound from '@/components/no-tech-found';
import TechRow from '@/components/TechRow';
import TechLookup from '@/utils/TechLookup';

type TechResultsPageProps = {
  params: { domain: string };
};

const TechResultsPage = async ({
  params: { domain },
}: TechResultsPageProps) => {
  const tech = await TechLookup.fetchTechs(domain);

  if (!tech.length) {
    return <NoTechFound />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {tech.map((t: any) => (
        <TechRow tech={t} />
      ))}
    </div>
  );
};

export default TechResultsPage;
