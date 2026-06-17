'use client'

import { signIn } from 'next-auth/react'

export function ConnectGmailButton() {
  return (
    <button
      onClick={() =>
        signIn('google', { callbackUrl: '/dashboard' }, {
          scope:       'openid email profile https://www.googleapis.com/auth/gmail.readonly',
          access_type: 'offline',
          prompt:      'consent',
        })
      }
      className="flex items-center gap-3 px-7 py-3.5 bg-[#f8f8f8] text-[#050505] rounded-full text-sm font-medium hover:bg-white transition-colors duration-200 cursor-pointer"
    >
      <GmailIcon />
      Connect Gmail
    </button>
  )
}

function GmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
        fill="#EA4335"
      />
    </svg>
  )
}
