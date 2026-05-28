import { GoogleAuth, IdTokenClient } from 'google-auth-library';

let cachedClient: IdTokenClient | undefined;

async function getClient(): Promise<IdTokenClient> {
  if (cachedClient) return cachedClient;

  const clientEmail = process.env.GCP_INVOKER_CLIENT_EMAIL;
  const privateKey = process.env.GCP_INVOKER_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const audience = process.env.COMPRESSOR_BASE_URL;

  if (!clientEmail || !privateKey || !audience) {
    throw new Error('Missing GCP_INVOKER_CLIENT_EMAIL, GCP_INVOKER_PRIVATE_KEY, or COMPRESSOR_BASE_URL');
  }

  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
  });

  cachedClient = await auth.getIdTokenClient(audience);
  return cachedClient;
}

export async function compressorAuthHeader(): Promise<{ Authorization: string }> {
  const client = await getClient();
  const headers = await client.getRequestHeaders();
  const authorization = headers.get?.('authorization') ?? (headers as unknown as Record<string, string>).Authorization;
  if (!authorization) throw new Error('Failed to obtain Cloud Run ID token');
  return { Authorization: authorization };
}

export function compressorUrl(path: string): string {
  const base = process.env.COMPRESSOR_BASE_URL;
  if (!base) throw new Error('Missing COMPRESSOR_BASE_URL');
  return `${base}${path}`;
}
