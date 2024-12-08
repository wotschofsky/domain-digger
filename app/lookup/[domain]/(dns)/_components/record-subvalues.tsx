import type { FC } from 'react';

import type { RecordContextEntry } from '@/lib/record-context';

type RecordSubvaluesProps = {
  subvalues: RecordContextEntry[];
};

export const RecordSubvalues: FC<RecordSubvaluesProps> = ({ subvalues }) => (
  <span className="mt-1 block break-words text-xs text-zinc-500 dark:text-zinc-400">
    {subvalues.map((s, i) => (
      <>
        {i > 0 && ' / '}
        {s.url ? (
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted"
          >
            {s.description}
          </a>
        ) : (
          s.description
        )}
      </>
    ))}
  </span>
);
