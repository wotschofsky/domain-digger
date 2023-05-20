import {
  Box,
  ButtonGroup,
  IconButton,
  Stack,
  Text,
  useColorMode,
} from '@chakra-ui/react';
import Link from 'next/link';
import { FaMoon, FaSun } from 'react-icons/fa';

const Header = () => {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
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
        <ButtonGroup variant="ghost" color="gray.600">
          <IconButton
            as="a"
            href="#"
            onClick={toggleColorMode}
            aria-label="Color Mode"
            icon={
              colorMode === 'light' ? (
                <FaMoon fontSize="20px" />
              ) : (
                <FaSun fontSize="20px" />
              )
            }
          />
        </ButtonGroup>
      </Stack>
    </Box>
  );
};

export default Header;
