'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/signin' })}
      className="text-sm text-[#444] hover:text-[#f8f8f8] transition-colors duration-200 cursor-pointer"
    >
      Sign out
    </button>
  )
}
