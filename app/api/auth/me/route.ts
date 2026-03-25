import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { getUserById } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ user: null })

  const user = getUserById(auth.userId)
  if (!user) return NextResponse.json({ user: null })

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      chips_total: user.chips_total,
      games_played: user.games_played,
      games_won: user.games_won,
    },
  })
}
