import { Center, Link, Progress } from '@chakra-ui/react';
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

  if (!target) {
    return <Progress size="xs" isIndeterminate />;
  }

  return (
    <Center>
      <Link href={target}>Inspect Domain</Link>
    </Center>
  );
};

export default BookmarkletLink;
