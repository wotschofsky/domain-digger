'use client';

import Image from 'next/image';

const TechRow = ({ tech }: { tech: any }) => {
    return (
        <div>
            <a href={tech.website} target='_blank' className="cursor-pointer bg-gray-50 dark:bg-slate-950 p-4 rounded-lg w-full grid">
                <div className="flex justify-between">
                    <div className="h-8 w-8 rounded bg-white ring-gray-300 ring-1 flex">
                        <Image src={'/icons/' + tech.name.toLowerCase().replaceAll(" ", "").replaceAll(".", "") + '.png'} className='h-4 w-auto m-auto' alt={tech.name} width={0} height={0} />
                    </div>
                    <p className="text-lg font-semibold">{tech.name}</p>
                </div>
                <div className='mt-2 space-x-2'>
                    <span className="inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-900 ring-1 ring-inset ring-gray-200">
                        <svg className="h-1.5 w-1.5 fill-slate-950" viewBox="0 0 6 6" aria-hidden="true">
                            <circle cx={3} cy={3} r={3} />
                        </svg>
                        {tech.category}
                    </span>
                    <span className="inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-900 ring-1 ring-inset ring-gray-200">
                        <svg className="h-1.5 w-1.5 fill-slate-950" viewBox="0 0 6 6" aria-hidden="true">
                            <circle cx={3} cy={3} r={3} />
                        </svg>
                        {tech.group}
                    </span>
                </div>
            </a>
        </div>
    );
}

export default TechRow;