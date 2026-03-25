import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple JWT decode without verification for Edge Runtime
// Actual verification happens in API route handlers using the full jwt lib
function decodeJwtPayload(token: string): { userId: number; username: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    // Base64url decode
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(padded.padEnd(padded.length + ((4 - padded.length % 4) % 4), '='))
    const data = JSON.parse(decoded)
    // Check expiry
    if (data.exp && data.exp < Date.now() / 1000) return null
    return { userId: data.userId, username: data.username }
  } catch {
    return null
  }
}

const PUBLIC_API_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/me', '/api/leaderboard']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Static assets, Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/fonts') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  const token = req.cookies.get('poker_auth')?.value

  if (!token) {
    // Block authenticated-only API routes
    if (pathname.startsWith('/api/') && !PUBLIC_API_PATHS.some(p => pathname.startsWith(p))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const payload = decodeJwtPayload(token)
  if (!payload) {
    if (pathname.startsWith('/api/') && !PUBLIC_API_PATHS.some(p => pathname.startsWith(p))) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const res = NextResponse.next()
  res.headers.set('x-user-id', String(payload.userId))
  res.headers.set('x-username', payload.username)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
