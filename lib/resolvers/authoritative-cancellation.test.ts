// @vitest-environment node
import type * as Net from 'node:net';

import type { DecodedPacket } from 'dns-packet';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthoritativeResolver } from './authoritative';

const { socket, tcpSocket } = vi.hoisted(() => ({
  tcpSocket: { on: vi.fn(), write: vi.fn(), destroy: vi.fn() },
  socket: { on: vi.fn(), send: vi.fn(), close: vi.fn() },
}));
vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof Net>();
  return {
    ...actual,
    default: { ...actual, createConnection: () => tcpSocket },
  };
});
vi.mock('node:dgram', () => ({ default: { createSocket: () => socket } }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('authoritative transport cancellation', () => {
  it('destroys an in-flight TCP fallback and clears its timeout when cancelled', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const resolver = new AuthoritativeResolver({
      signal: controller.signal,
      requestRetries: 0,
      rootServers: async () => ['192.0.2.1'],
      udpTransport: async () => ({ flag_tc: true }) as DecodedPacket,
    });
    const pending = resolver
      .resolveAnswers('example.com', 'DNSKEY')
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(tcpSocket.on).toHaveBeenCalled());
    controller.abort();
    expect(await pending).toBeInstanceOf(Error);
    expect(tcpSocket.destroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes an in-flight UDP socket and clears its timeout when cancelled', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const resolver = new AuthoritativeResolver({
      signal: controller.signal,
      requestRetries: 0,
      rootServers: async () => ['192.0.2.1'],
    });
    const pending = resolver
      .resolveAnswers('example.com', 'A')
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalledOnce());
    controller.abort();
    expect(await pending).toBeInstanceOf(Error);
    expect(socket.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
