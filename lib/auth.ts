import * as jose from 'jose';
import { AUTH_CONFIG } from './constants';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || AUTH_CONFIG.JWT_SECRET_FALLBACK);

export interface JWTPayload {
  id: string;
  email: string;
  role: 'admin' | 'employee';
  is2FAVerified?: boolean;
}

export const signToken = async (payload: JWTPayload) => {
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(AUTH_CONFIG.JWT_EXPIRATION)
    .sign(JWT_SECRET);
};

export const verifyToken = async (token: string) => {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch (error) {
    return null;
  }
};
