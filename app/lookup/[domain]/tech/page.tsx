import TechRow from '@/components/TechRow';
import NoTechFound from '@/components/no-tech-found';
import TechLookup from '@/utils/TechLookup'

type TechResultsPageProps = {
    params: { domain: string };
};

const TechResultsPage = async ({
    params: { domain },
}: TechResultsPageProps) => {
    const tech = await TechLookup.fetchTechs(domain);
    
    if (!tech.length) {
        return (
            <NoTechFound />
        );
    }

    return (
        <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {tech.map((t: any) => (
                <TechRow tech={t} />
            ))}
        </div>
    );
};

export default TechResultsPage;