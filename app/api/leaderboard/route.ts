import { NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/db'

export async function GET() {
  try {
    const board = getLeaderboard()
    return NextResponse.json({ leaderboard: board })
  } catch {
    return NextResponse.json({ leaderboard: [] })
  }
}
