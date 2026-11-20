// @vitest-environment node
import type * as dgramModule from 'node:dgram';
import { EventEmitter } from 'node:events';

import dnsPacket, { type DecodedPacket } from 'dns-packet';
import { describe, expect, it, vi } from 'vitest';

import {
  type AuthoritativeRequest,
  AuthoritativeResolver,
} from './authoritative';

// The UDP transport talks to port 53 directly, so a fake socket stands in
// for the nameserver: it records the query it receives and sends back the
// replies built from it, in order.
const server = vi.hoisted(() => ({
  respond: (() => []) as (query: Buffer) => Buffer[],
  queries: [] as Buffer[],
}));

vi.mock('node:dgram', async (importOriginal) => ({
  ...(await importOriginal<typeof dgramModule>()),
  default: {
    createSocket: () => {
      const socket = Object.assign(new EventEmitter(), {
        send: (query: Buffer) => {
          server.queries.push(query);
          setImmediate(() => {
            for (const reply of server.respond(query)) {
              socket.emit('message', reply, { address: '192.0.2.1', port: 53 });
            }
          });
        },
        close: () => socket,
      });
      return socket;
    },
  },
}));

const sendUdpRequest = (request: Partial<AuthoritativeRequest>) =>
  new AuthoritativeResolver()['sendUdpRequest']({
    domain: 'example.com',
    recordType: 'A',
    nameserver: '192.0.2.1',
    dnssecOk: false,
    ...request,
  });

// A FORMERR that echoes no question and no OPT record, the way the servers
// of mail.protection.outlook.com reject EDNS, then the answer to the query.
const bareFormerrThenAnswer = (query: Buffer): Buffer[] => {
  const id = query.readUInt16BE(0);
  return [
    // The rcode is the low four bits of the flags; 1 is FORMERR.
    dnsPacket.encode({ type: 'response', id, flags: 1 }),
    dnsPacket.encode({
      type: 'response',
      id,
      questions: [{ type: 'A', name: 'example.com' }],
      answers: [
        { type: 'A', name: 'example.com', ttl: 300, data: '203.0.113.7' },
      ],
    }),
  ];
};

const lastQuery = (): DecodedPacket => dnsPacket.decode(server.queries.at(-1)!);

describe('AuthoritativeResolver UDP transport', () => {
  it.each([
    [false, 0],
    [true, dnsPacket.DNSSEC_OK],
  ])('advertises 1232 bytes with DNSSEC %s', async (dnssecOk, flags) => {
    server.respond = bareFormerrThenAnswer;

    await sendUdpRequest({ dnssecOk });

    expect(lastQuery().additionals).toEqual([
      expect.objectContaining({ type: 'OPT', udpPayloadSize: 1232, flags }),
    ]);
  });

  it('sends a plain-DNS query without the OPT record', async () => {
    server.respond = bareFormerrThenAnswer;

    await sendUdpRequest({ plainDns: true });

    expect(lastQuery().additionals).toEqual([]);
  });

  it.each([
    [{}, 'FORMERR'],
    [{ dnssecOk: true }, 'NOERROR'],
    [{ plainDns: true as const }, 'NOERROR'],
  ])(
    'takes a question-less FORMERR only as the answer to an EDNS query that gets the plain retry (%o)',
    async (request, rcode) => {
      server.respond = bareFormerrThenAnswer;

      await expect(sendUdpRequest(request)).resolves.toMatchObject({ rcode });
    },
  );
});
