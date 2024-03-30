import type { FC } from 'react';

export type SubvalueInfo = {
  description: string;
  url?: string;
};

type RecordSubvaluesProps = {
  subvalues: SubvalueInfo[];
};

export const RecordSubvalues: FC<RecordSubvaluesProps> = ({ subvalues }) => (
  <span className="mt-1 block break-words text-xs text-muted-foreground">
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
