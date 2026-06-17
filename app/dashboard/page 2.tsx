// Milestone 1 stub — confirms auth works end-to-end
// Will be replaced with the real dashboard in Milestone 4
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/SignOutButton'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/signin')

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6 gap-6">

      <p className="text-[#f8f8f8] text-lg font-semibold tracking-tight">Uyra</p>

      <div className="border border-white/8 rounded-2xl p-8 max-w-sm w-full text-center space-y-3">
        <p className="text-xs tracking-widest uppercase text-[#555]">Signed in as</p>
        <p className="text-[#f8f8f8] font-medium">{session.user?.name}</p>
        <p className="text-[#555] text-sm">{session.user?.email}</p>
      </div>

      <p className="text-[#333] text-sm">
        ✓ Auth working — Gmail integration coming in Milestone 2
      </p>

      <SignOutButton />

    </main>
  )
}
