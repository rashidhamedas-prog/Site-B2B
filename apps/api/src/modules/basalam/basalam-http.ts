import { Injectable } from '@nestjs/common';

/** Nest DI token for {@link BasalamHttp}. */
export const BASALAM_HTTP = Symbol('BASALAM_HTTP');

export type BasalamHttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type BasalamHttpRequest = {
  method: BasalamHttpMethod;
  url: string;
  headers?: Record<string, string>;
  /** Plain objects are JSON-encoded; FormData is sent as multipart. */
  body?: unknown;
  timeoutMs?: number;
};

export type BasalamHttpResponse = {
  ok: boolean;
  status: number;
  /** Parsed JSON body, or `{}` when the body is empty / not JSON. */
  json: unknown;
};

export type BasalamBinaryResponse = {
  ok: boolean;
  status: number;
  contentType: string;
  bytes: Uint8Array;
};

/**
 * Every outbound call of the Basalam integration goes through this port, so tests and dry-run
 * can prove zero network traffic. Implementations must never log Authorization headers.
 */
export interface BasalamHttp {
  /** JSON request to Basalam (OpenAPI / Core). */
  request(req: BasalamHttpRequest): Promise<BasalamHttpResponse>;
  /** Binary GET (product photo download before upload). */
  download(url: string, timeoutMs?: number): Promise<BasalamBinaryResponse>;
}

@Injectable()
export class FetchBasalamHttp implements BasalamHttp {
  async request(req: BasalamHttpRequest): Promise<BasalamHttpResponse> {
    const isForm = typeof FormData !== 'undefined' && req.body instanceof FormData;
    const body =
      req.body === undefined ? undefined : isForm ? (req.body as FormData) : JSON.stringify(req.body);
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body,
      signal: AbortSignal.timeout(req.timeoutMs ?? 15_000),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }

  async download(url: string, timeoutMs = 20_000): Promise<BasalamBinaryResponse> {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'image/*' },
    });
    if (!res.ok) return { ok: false, status: res.status, contentType: '', bytes: new Uint8Array() };
    return {
      ok: true,
      status: res.status,
      contentType: res.headers.get('content-type') || '',
      bytes: new Uint8Array(await res.arrayBuffer()),
    };
  }
}
