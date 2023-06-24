import fs from 'fs';
import path from 'path';
import WebsiteAnalyzer from 'website-analysis-api/src/WebsiteAnalyzer';

class TechLookup {
    static async fetchTechs(
        domain: string
    ): Promise<any> {
        const path = './utils/stack/';

        const analyzer = new WebsiteAnalyzer({
            url: 'https://' + domain + '/',
            technologiesFile: path + 'technologies.json',
            categoriesFile: path + 'categories.json',
            groupsFile: path + 'groups.json',
        });

        const data = await analyzer.analyze();
        return data;
    }
}

export default TechLookup;