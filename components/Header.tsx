import Link from 'next/link';
import { Box, Stack, Text } from '@chakra-ui/react';

const Header = () => (
  <Box
    as="header"
    role="contentinfo"
    w="100%"
    maxW="7xl"
    py="4"
    px={{ base: '4', md: '8' }}
  >
    <Stack direction="row" spacing="4" align="center" justify="space-between">
      <Text fontSize="xl">
        <Link href="/">Domain Digger</Link>
      </Text>
    </Stack>
  </Box>
);

export default Header;
