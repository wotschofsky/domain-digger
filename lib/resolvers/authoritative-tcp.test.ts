// @vitest-environment node
import type * as netModule from 'node:net';
import { EventEmitter } from 'node:events';

import { expect, it, vi } from 'vitest';

import { AuthoritativeResolver } from './authoritative';

// The TCP transport talks to port 53 directly, so a fake socket stands in
// for the nameserver and replies with whatever bytes the test hands it.
const reply = vi.hoisted(() => ({ bytes: Buffer.alloc(0) }));

vi.mock('node:net', async (importOriginal) => ({
  ...(await importOriginal<typeof netModule>()),
  default: {
    createConnection: (_port: number, _host: string, onConnect: () => void) => {
      const socket = Object.assign(new EventEmitter(), {
        write: () => {
          setImmediate(() => socket.emit('data', reply.bytes));
          return true;
        },
        destroy: () => socket,
      });
      setImmediate(onConnect);
      return socket;
    },
  },
}));

it('rejects a malformed TCP reply instead of throwing from the socket handler', async () => {
  // A complete frame whose one-byte body is shorter than a DNS header
  reply.bytes = Buffer.from([0x00, 0x01, 0x00]);
  const resolver = new AuthoritativeResolver();

  await expect(
    resolver['sendTcpRequest']({
      domain: 'example.com',
      recordType: 'A',
      nameserver: '192.0.2.1',
      dnssecOk: false,
    }),
  ).rejects.toThrow('Could not decode the TCP DNS response');
});
