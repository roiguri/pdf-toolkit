import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './firebase-admin';

export async function verifyAuth(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);

  // API key — for external callers
  const apiKey = process.env.PDF_API_KEY;
  if (apiKey && token === apiKey) return true;

  // Firebase ID token — for authenticated UI users
  try {
    getAdminApp();
    await getAuth().verifyIdToken(token);
    return true;
  } catch {
    return false;
  }
}
