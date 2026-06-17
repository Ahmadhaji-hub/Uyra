import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/SignOutButton'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/signin')

  const gmailStatus = session.gmailStatus ?? 'disconnected'

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6 gap-6">

      <p className="text-[#f8f8f8] text-lg font-semibold tracking-tight">Uyra</p>

      {/* User card */}
      <div className="border border-white/8 rounded-2xl p-8 max-w-sm w-full text-center space-y-3">
        <p className="text-xs tracking-widest uppercase text-[#555]">Signed in as</p>
        <p className="text-[#f8f8f8] font-medium">{session.user?.name}</p>
        <p className="text-[#555] text-sm">{session.user?.email}</p>
      </div>

      {/* Gmail connection status */}
      <div className="border border-white/8 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
        <p className="text-xs tracking-widest uppercase text-[#555]">Gmail</p>

        {gmailStatus === 'connected' ? (
          <>
            <p className="text-[#f8f8f8] font-medium flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Gmail Connected
            </p>
            <Link
              href="/inbox"
              className="inline-block px-6 py-2.5 text-sm rounded-full bg-[#f8f8f8] text-[#050505] font-medium hover:bg-white transition-colors duration-200"
            >
              Open Inbox Analysis
            </Link>
            <Link
              href="/memory"
              className="inline-block px-6 py-2.5 text-sm rounded-full border border-white/12 text-[#888] hover:text-[#f8f8f8] hover:border-white/20 transition-all duration-200"
            >
              Memory Inspector
            </Link>
          </>
        ) : gmailStatus === 'needs_reconnect' ? (
          <>
            <p className="text-amber-400/80 text-sm font-medium flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Gmail access expired
            </p>
            <p className="text-[#555] text-xs leading-relaxed">
              Your session expired. Reconnect to restore inbox intelligence.
            </p>
            <Link
              href="/connect"
              className="inline-block px-6 py-2.5 text-sm rounded-full border border-amber-400/30 text-amber-400/80 hover:bg-amber-400/6 transition-all duration-200"
            >
              Reconnect Gmail
            </Link>
          </>
        ) : (
          <>
            <p className="text-[#555] text-sm leading-relaxed">
              Connect your Gmail to see who matters,
              what&apos;s active, and what needs a reply.
            </p>
            <Link
              href="/connect"
              className="inline-block px-6 py-2.5 text-sm rounded-full border border-white/12 text-[#f8f8f8] hover:bg-white/6 hover:border-white/20 transition-all duration-200"
            >
              Connect Gmail
            </Link>
          </>
        )}
      </div>

      <SignOutButton />

    </main>
  )
}
