import {
  Box,
  ButtonGroup,
  Divider,
  Icon,
  IconButton,
  Link,
  Stack,
  Text,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { FaGithub, FaHeart } from 'react-icons/fa';

const Footer = () => (
  <Box
    as="footer"
    role="contentinfo"
    w="100%"
    maxW="7xl"
    py={4}
    px={{ base: '4', md: '8' }}
  >
    <Divider mb={4} />
    <Stack direction={{ base: 'column', sm: 'row' }} spacing="4" align="center" justify="space-between">
      <Text fontSize="sm">
        Created with <Icon as={FaHeart} mx="2px" w={5} h={5} color="red.500" />{' '}
        by{' '}
        <Link href="https://felisk.io" isExternal>
          Felix Wotschofsky <ExternalLinkIcon mx="2px" />
        </Link>
      </Text>
      <ButtonGroup variant="ghost" color="gray.600">
        <IconButton
          as="a"
          href="https://github.com/feliskio/domain-digger"
          target="_blank"
          aria-label="GitHub"
          icon={<FaGithub fontSize="20px" />}
        />
      </ButtonGroup>
    </Stack>
  </Box>
);

export default Footer;
