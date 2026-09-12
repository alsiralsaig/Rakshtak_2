import { jwtVerify, SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.RAKSHTAK_ADMIN_TOKEN || "your-secret-key-change-this"
);

interface DriverPayload {
  id: number;
  phone: string;
  iat?: number;
  exp?: number;
}

/**
 * توقيع رمز JWT للسائق
 */
export function signDriverToken(driverId: number): string {
  const payload: DriverPayload = {
    id: driverId,
    phone: "",
  };

  const token = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);

  return token as unknown as string;
}

/**
 * التحقق من رمز JWT للسائق
 */
export async function verifyDriverToken(token: string): Promise<DriverPayload | null> {
  try {
    const verified = await jwtVerify(token, SECRET);
    return verified.payload as DriverPayload;
  } catch {
    return null;
  }
}

/**
 * استخراج رمز السائق من رؤوس الطلب
 */
export function getDriverTokenFromHeaders(authHeader: string): string | null {
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
