import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelRequest = IncomingMessage & { body?: unknown };

function readStream(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function requestBody(request: VercelRequest): Promise<Buffer> {
  if (request.body === undefined) return readStream(request);
  if (Buffer.isBuffer(request.body)) return Promise.resolve(request.body);
  if (typeof request.body === 'string') return Promise.resolve(Buffer.from(request.body));
  return Promise.resolve(Buffer.from(JSON.stringify(request.body)));
}

export default async function handler(request: VercelRequest, response: ServerResponse) {
  const configuredOrigin = process.env.INCIDENTIQ_API_ORIGIN;
  const proxyToken = process.env.INCIDENTIQ_API_TOKEN;

  if (!configuredOrigin || !proxyToken) {
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      error: 'IncidentIQ backend is not configured. Set INCIDENTIQ_API_ORIGIN and INCIDENTIQ_API_TOKEN in Vercel.'
    }));
    return;
  }

  let backendOrigin: URL;
  try {
    backendOrigin = new URL(configuredOrigin);
  } catch {
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'INCIDENTIQ_API_ORIGIN must be a valid backend URL.' }));
    return;
  }

  const isLocalHttp = backendOrigin.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(backendOrigin.hostname);
  if (backendOrigin.protocol !== 'https:' && !isLocalHttp) {
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'INCIDENTIQ_API_ORIGIN must use HTTPS.' }));
    return;
  }
  if (backendOrigin.pathname !== '/' || backendOrigin.search || backendOrigin.hash ||
    backendOrigin.username || backendOrigin.password) {
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'INCIDENTIQ_API_ORIGIN must be an origin without credentials, path, query, or fragment.' }));
    return;
  }

  const incomingUrl = new URL(request.url || '/', 'https://vercel.invalid');
  if (!incomingUrl.pathname.startsWith('/api/')) {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Unknown API route.' }));
    return;
  }

  const target = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backendOrigin);
  const headers = new Headers({
    'x-incidentiq-api-token': proxyToken
  });
  const contentType = request.headers['content-type'];
  const accept = request.headers.accept;
  if (contentType) headers.set('content-type', Array.isArray(contentType) ? contentType[0] : contentType);
  if (accept) headers.set('accept', Array.isArray(accept) ? accept.join(', ') : accept);

  try {
    const method = request.method || 'GET';
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await requestBody(request);
    const backendResponse = await fetch(target, {
      method,
      headers,
      body: body?.byteLength ? new Uint8Array(body) : undefined
    });
    const responseHeaders: Record<string, string> = {
      'content-type': backendResponse.headers.get('content-type') || 'application/json'
    };
    const cacheControl = backendResponse.headers.get('cache-control');
    if (cacheControl) responseHeaders['cache-control'] = cacheControl;

    response.writeHead(backendResponse.status, responseHeaders);
    response.end(Buffer.from(await backendResponse.arrayBuffer()));
  } catch (error) {
    console.error('[IncidentIQ] Backend proxy request failed:', error);
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'IncidentIQ backend request failed.' }));
  }
}
