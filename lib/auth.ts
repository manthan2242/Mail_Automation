import * as jose from 'jose';
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET is not defined in environment variables.');
}
const JWT_SECRET = new TextEncoder().encode(secret);

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
    .setExpirationTime('1d')
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

