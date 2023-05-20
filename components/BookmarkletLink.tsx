'use client';

import { useEffect, useState } from 'react';

const BookmarkletLink = () => {
  const [target, setTarget] = useState('');

  useEffect(() => {
    const rawScript = `
      (function(){
        var tab = window.open('${location.origin}/lookup/'+location.hostname, '_blank');
        if (!tab) {
          alert('Could not open results in new tab!');
          return;
        }
        tab.focus();
      })();
    `;
    const minifiedScript = rawScript
      .split('\n')
      .map((line) => line.trim())
      .join('');
    setTarget(`javascript:${minifiedScript}`);
  }, []);

  return (
    <div className="flex justify-center">
      {target ? (
        <a className="text-center" href={target}>
          Inspect Domain
        </a>
      ) : (
        <span className="text-center">Loading...</span>
      )}
    </div>
  );
};

export default BookmarkletLink;
