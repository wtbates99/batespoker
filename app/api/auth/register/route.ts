import { NextRequest, NextResponse } from 'next/server'
import { createUser, getUserByUsername } from '@/lib/db'
import { hashPassword, signToken, COOKIE_OPTIONS } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }
  if (username.length < 3 || username.length > 20) {
    return NextResponse.json({ error: 'Username must be 3–20 characters' }, { status: 400 })
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json({ error: 'Username: letters, numbers, underscores only' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const existing = getUserByUsername(username)
  if (existing) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const hashed = await hashPassword(password)
  const user = createUser(username, hashed)
  const token = signToken({ userId: user.id, username: user.username })

  const res = NextResponse.json({ user: { id: user.id, username: user.username } })
  res.cookies.set({ ...COOKIE_OPTIONS, value: token })
  return res
}
