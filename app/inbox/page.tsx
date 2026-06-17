// Milestone 2 placeholder — inbox analysis coming in Milestone 3
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function InboxPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/signin')
  if (!session.gmailConnected) redirect('/connect')

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6 gap-6">

      <p className="text-[#f8f8f8] text-lg font-semibold tracking-tight">Uyra</p>

      <div className="border border-white/8 rounded-2xl p-10 max-w-sm w-full text-center space-y-4">
        <div className="w-2 h-2 rounded-full bg-[#9b8fff] animate-pulse mx-auto" />
        <p className="text-xs tracking-widest uppercase text-[#555]">Coming in Milestone 3</p>
        <p className="text-[#f8f8f8] font-medium text-lg">Inbox Analysis</p>
        <p className="text-[#555] text-sm leading-relaxed">
          Gmail is connected. Inbox analysis will be available in the next milestone.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="text-xs text-[#333] hover:text-[#7a7a7a] transition-colors duration-200"
      >
        Back to dashboard
      </Link>

    </main>
  )
}
