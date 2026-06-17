import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { analyzeInbox } from '@/lib/gmail'

export async function GET() {
  // 1. Auth check
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // ── Gmail connection state gate ───────────────────────────────────────────
  // 'needs_reconnect' — refresh token revoked or scopes changed; user must
  //   re-grant via the connect page. Return 401 so the client routes there.
  // 'disconnected'    — user has never connected Gmail. Return 403.
  // 'connected'       — access token is valid, proceed.
  if (session.gmailStatus === 'needs_reconnect') {
    return NextResponse.json(
      { error: 'Gmail access expired. Please reconnect.', code: 'GMAIL_NEEDS_RECONNECT' },
      { status: 401 }
    )
  }

  if (session.gmailStatus !== 'connected') {
    return NextResponse.json(
      { error: 'Gmail not connected.', code: 'GMAIL_NOT_CONNECTED' },
      { status: 403 }
    )
  }

  if (!session.accessToken) {
    return NextResponse.json(
      { error: 'Missing access token. Please sign in again.' },
      { status: 401 }
    )
  }

  if (!session.user?.email) {
    return NextResponse.json({ error: 'Missing user email' }, { status: 400 })
  }

  // 2. Run analysis
  try {
    const analysis = await analyzeInbox(session.accessToken, session.user.email)
    return NextResponse.json(analysis)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed'

    // Token expired — tell client to re-authenticate
    if (message.includes('401') || message.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Session expired. Please sign in again.', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      )
    }

    console.error('[inbox/analyze] error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
