// @vitest-environment node
import type * as netModule from 'node:net';
import { EventEmitter } from 'node:events';

import dnsPacket from 'dns-packet';
import { describe, expect, it, vi } from 'vitest';

import { AuthoritativeResolver } from './authoritative';

// The TCP transport talks to port 53 directly, so a fake socket stands in
// for the nameserver: it builds its reply from the query it receives, then
// optionally closes the connection.
const server = vi.hoisted(() => ({
  respond: (() => Buffer.alloc(0)) as (query: Buffer) => Buffer,
  closeAfterReply: false,
}));

vi.mock('node:net', async (importOriginal) => ({
  ...(await importOriginal<typeof netModule>()),
  default: {
    createConnection: (_port: number, _host: string, onConnect: () => void) => {
      const socket = Object.assign(new EventEmitter(), {
        write: (query: Buffer) => {
          setImmediate(() => {
            socket.emit('data', server.respond(query));
            if (server.closeAfterReply) socket.emit('end');
          });
          return true;
        },
        destroy: () => socket,
      });
      setImmediate(onConnect);
      return socket;
    },
  },
}));

const request = {
  domain: 'example.com',
  recordType: 'A',
  nameserver: '192.0.2.1',
  dnssecOk: false,
} as const;

// A length-prefixed reply that echoes the query's ID and question
const answerTo = (query: Buffer): Buffer =>
  dnsPacket.streamEncode({
    type: 'response',
    id: query.readUInt16BE(2),
    questions: [{ type: 'A', name: 'example.com' }],
    answers: [
      { type: 'A', name: 'example.com', ttl: 300, data: '203.0.113.7' },
    ],
  });

const sendTcpRequest = () =>
  new AuthoritativeResolver()['sendTcpRequest'](request);

describe('AuthoritativeResolver TCP transport', () => {
  it('resolves a well-formed reply', async () => {
    server.respond = answerTo;
    server.closeAfterReply = false;

    const packet = await sendTcpRequest();

    expect(packet.answers).toEqual([
      expect.objectContaining({ data: '203.0.113.7' }),
    ]);
  });

  it('rejects a malformed TCP reply instead of throwing from the socket handler', async () => {
    // A complete frame whose one-byte body is shorter than a DNS header
    server.respond = () => Buffer.from([0x00, 0x01, 0x00]);
    server.closeAfterReply = false;

    await expect(sendTcpRequest()).rejects.toThrow(
      'Could not decode the TCP DNS response',
    );
  });

  it('decodes only the bytes the length prefix declares', async () => {
    // Declares a one-byte message, then sends a whole matching reply after it
    server.respond = (query) =>
      Buffer.concat([Buffer.from([0x00, 0x01]), answerTo(query).subarray(2)]);
    server.closeAfterReply = false;

    await expect(sendTcpRequest()).rejects.toThrow(
      'Could not decode the TCP DNS response',
    );
  });

  it('rejects as soon as the server closes mid-frame', async () => {
    // Declares a 32-byte message but sends only one byte of it
    server.respond = () => Buffer.from([0x00, 0x20, 0x00]);
    server.closeAfterReply = true;

    await expect(sendTcpRequest()).rejects.toThrow(
      'TCP connection closed before a full DNS response arrived',
    );
  });
});
