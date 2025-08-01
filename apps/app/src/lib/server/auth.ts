import { SignJWT, jwtVerify } from 'jose';
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  isFirstLogin: boolean;
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

export async function createToken(user: AuthUser): Promise<string> {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    isFirstLogin: user.isFirstLogin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  return token;
}

export async function verifyToken(token: string): Promise<AuthUser> {
  try {
    const { payload } = await jwtVerify<AuthUser>(token, JWT_SECRET);
    // Verify necessary fields exist
    if (!payload.id || !payload.email) {
      throw new Error('Invalid token payload');
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      isFirstLogin: payload.isFirstLogin,
    };
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Get token from header
export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}
