import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ConnectGmailButton } from '@/components/ConnectGmailButton'
import Link from 'next/link'

export default async function ConnectPage() {
  const session = await getServerSession(authOptions)

  // Not signed in — middleware handles this, but guard here too
  if (!session) redirect('/signin')

  // ── Connection state routing ───────────────────────────────────────────────
  // 'connected'       → nothing to do here, send to dashboard
  // 'disconnected'    → show standard connect flow
  // 'needs_reconnect' → show reconnect variant (DO NOT redirect — that's the loop)
  if (session.gmailStatus === 'connected') redirect('/dashboard')

  const isReconnect = session.gmailStatus === 'needs_reconnect'

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6">

      {/* Wordmark */}
      <p className="text-[#f8f8f8] text-lg font-semibold tracking-tight mb-14">
        Uyra
      </p>

      {/* Headline — reconnect variant */}
      <h1 className="text-[clamp(1.8rem,4vw,3rem)] font-semibold tracking-[-0.04em] text-[#f8f8f8] text-center leading-tight mb-4">
        {isReconnect ? 'Reconnect your Gmail' : 'Connect your Gmail'}
      </h1>

      <p className="text-[#555] text-base text-center mb-3 max-w-sm leading-relaxed">
        {isReconnect
          ? 'Your Gmail access has expired. Reconnect to restore inbox intelligence.'
          : 'Uyra will read your inbox to identify who matters, what\'s active, and what needs a reply.'
        }
      </p>

      {/* Reconnect notice */}
      {isReconnect && (
        <p className="text-xs text-amber-400/60 text-center mb-3 max-w-xs">
          Your history and data are preserved — this only refreshes access.
        </p>
      )}

      {/* What access means */}
      <div className="mb-12 space-y-2 text-center">
        <p className="text-xs text-[#333]">✓ Read-only access — Uyra cannot send or modify emails</p>
        <p className="text-xs text-[#333]">✓ Email content is never stored</p>
        <p className="text-xs text-[#333]">✓ You can disconnect at any time</p>
      </div>

      <ConnectGmailButton />

      <Link
        href="/dashboard"
        className="mt-8 text-xs text-[#333] hover:text-[#7a7a7a] transition-colors duration-200"
      >
        Back to dashboard
      </Link>

    </main>
  )
}
