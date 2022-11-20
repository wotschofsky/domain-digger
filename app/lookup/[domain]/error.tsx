'use client';

import { Container } from '@chakra-ui/react';

const LookupDomainError = () => {
  return (
    <Container maxW="container.xl">
      <p>Failed loading results!</p>
    </Container>
  );
};

export default LookupDomainError;
