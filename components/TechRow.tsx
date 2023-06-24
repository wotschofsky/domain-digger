'use client';

import Image from 'next/image';

const TechRow = ({ tech }: { tech: any }) => {
  return (
    <div>
      <a
        href={tech.website}
        target="_blank"
        className="grid w-full cursor-pointer rounded-lg bg-gray-50 p-4 dark:bg-slate-950"
      >
        <div className="flex justify-between">
          <div className="flex h-8 w-8 rounded bg-white ring-1 ring-gray-300">
            <Image
              src={
                '/icons/' +
                tech.name
                  .toLowerCase()
                  .replaceAll(' ', '')
                  .replaceAll('.', '') +
                '.png'
              }
              className="m-auto h-4 w-auto"
              alt={tech.name}
              width={0}
              height={0}
            />
          </div>
          <p className="text-lg font-semibold">{tech.name}</p>
        </div>
        <div className="mt-2 space-x-2">
          <span className="inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-900 ring-1 ring-inset ring-gray-200">
            <svg
              className="h-1.5 w-1.5 fill-slate-950"
              viewBox="0 0 6 6"
              aria-hidden="true"
            >
              <circle cx={3} cy={3} r={3} />
            </svg>
            {tech.category}
          </span>
          <span className="inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-900 ring-1 ring-inset ring-gray-200">
            <svg
              className="h-1.5 w-1.5 fill-slate-950"
              viewBox="0 0 6 6"
              aria-hidden="true"
            >
              <circle cx={3} cy={3} r={3} />
            </svg>
            {tech.group}
          </span>
        </div>
      </a>
    </div>
  );
};

export default TechRow;
