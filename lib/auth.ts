import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production-32chars'
const COOKIE_NAME = 'poker_auth'

export interface TokenPayload {
  userId: number
  username: string
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function getTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null
}

export function getAuthFromRequest(req: NextRequest): TokenPayload | null {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyToken(token)
}

export const COOKIE_OPTIONS = {
  name: COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
}
