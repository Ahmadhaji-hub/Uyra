import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SignInButton from '@/components/SignInButton'

export default async function SignInPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6">

      {/* Wordmark */}
      <p className="text-[#f8f8f8] text-lg font-semibold tracking-tight mb-14">
        Uyra
      </p>

      {/* Headline */}
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-[-0.04em] text-[#f8f8f8] text-center leading-tight mb-4">
        Understand your inbox.
      </h1>

      <p className="text-[#555] text-base text-center mb-12 max-w-xs leading-relaxed">
        Sign in to connect your Gmail and see what actually matters.
      </p>

      <SignInButton />

      <p className="mt-10 text-xs text-[#2a2a2a] text-center max-w-xs leading-relaxed">
        Uyra requests read-only access to your Gmail.
        <br />Your emails are never stored.
      </p>

    </main>
  )
}
