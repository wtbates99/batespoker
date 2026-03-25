import { NextRequest, NextResponse } from 'next/server'
import { getUserByUsername } from '@/lib/db'
import { comparePassword, signToken, COOKIE_OPTIONS } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  const user = getUserByUsername(username)
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await comparePassword(password, user.password)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = signToken({ userId: user.id, username: user.username })
  const res = NextResponse.json({ user: { id: user.id, username: user.username } })
  res.cookies.set({ ...COOKIE_OPTIONS, value: token })
  return res
}
