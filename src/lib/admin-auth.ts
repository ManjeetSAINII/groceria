import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
const cookieName = 'store_admin_session';
function key() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters');
  return new TextEncoder().encode(secret);
}
export async function isAdmin() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  try { const { payload } = await jwtVerify(token, key(), { issuer: 'my-store', audience: 'admin' }); return payload.role === 'admin'; }
  catch { return false; }
}
export async function createSession() {
  const token = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuer('my-store').setAudience('admin').setIssuedAt().setExpirationTime('8h').sign(key());
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 60 * 60 * 8 });
}
export async function clearSession() { (await cookies()).delete(cookieName); }
