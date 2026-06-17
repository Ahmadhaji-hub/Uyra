import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Privacy Policy — Uyra',
  description: 'How Uyra collects, uses, and protects your personal information.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* Header */}
        <div className="space-y-2">
          <Link href="/" className="text-[#555] text-xs hover:text-[#f8f8f8] transition-colors duration-200">
            ← uyra.ai
          </Link>
          <h1 className="text-[#f8f8f8] text-2xl font-semibold tracking-tight pt-4">Privacy Policy</h1>
          <p className="text-[#555] text-sm">Last updated: June 2025</p>
        </div>

        <Section title="Overview">
          Uyra (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy
          explains how we collect, use, and safeguard your information when you use our service at
          uyra.ai. By using Uyra, you agree to the practices described in this policy.
        </Section>

        <Section title="Information We Collect">
          <p>When you sign in with Google, we receive the following from Google&apos;s OAuth service:</p>
          <ul className="mt-3 space-y-2 text-[#999] text-sm">
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Your name and email address (for account identification)</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>A Google profile picture URL (for display purposes only)</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>OAuth tokens required to access Google APIs on your behalf</li>
          </ul>
          <p className="mt-4">
            If you connect your Gmail account, we access your Gmail inbox using read-only permission
            (<code className="text-xs bg-white/5 px-1 py-0.5 rounded">gmail.readonly</code>).
            We fetch only the metadata headers of your emails — specifically: From, To, Subject, and Date.
            We never read, store, or transmit the body content of any email.
          </p>
        </Section>

        <Section title="How We Use Your Information">
          <p>We use your information solely to provide the Uyra service:</p>
          <ul className="mt-3 space-y-2 text-[#999] text-sm">
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>To authenticate you and maintain your session</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>To analyse your inbox metadata and surface insights (Important People, Active Topics, Needs Reply)</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>To communicate with you about service updates (if you opted in via our waitlist)</li>
          </ul>
          <p className="mt-4">
            We do not sell, rent, or share your personal information with third parties for marketing purposes.
          </p>
        </Section>

        <Section title="Google API Services">
          Uyra&apos;s use and transfer of information received from Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#f8f8f8] underline underline-offset-2 hover:text-white"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Specifically:
          <ul className="mt-3 space-y-2 text-[#999] text-sm">
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>We only request the minimum scopes necessary (<code className="text-xs bg-white/5 px-1 py-0.5 rounded">gmail.readonly</code>)</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Gmail data is processed in real time and is never stored on our servers</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>We do not use Gmail data to serve advertisements</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>We do not allow humans to read your Gmail data</li>
          </ul>
        </Section>

        <Section title="Data Retention">
          We do not persist your email content or metadata. Inbox analysis is performed on demand, in memory,
          and discarded immediately after your session. Your name and email address are stored only within
          your authenticated session cookie and are cleared when you sign out.
        </Section>

        <Section title="Data Security">
          We use industry-standard security measures including HTTPS encryption for all data in transit,
          secure session tokens, and OAuth 2.0 for authentication. We never store your Google account
          password or any credentials beyond the access tokens required to serve your requests.
        </Section>

        <Section title="Your Rights">
          <p>You may at any time:</p>
          <ul className="mt-3 space-y-2 text-[#999] text-sm">
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Sign out to clear your session and revoke Uyra&apos;s active access to your data</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Revoke Uyra&apos;s Gmail access at any time via your{' '}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[#f8f8f8] underline underline-offset-2 hover:text-white">
                Google Account permissions
              </a>
            </li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Request deletion of any data we hold by emailing us at hello@uyra.ai</li>
          </ul>
        </Section>

        <Section title="Children's Privacy">
          Uyra is not directed at children under the age of 13. We do not knowingly collect personal
          information from children under 13. If you believe we have inadvertently collected such
          information, please contact us immediately.
        </Section>

        <Section title="Changes to This Policy">
          We may update this Privacy Policy from time to time. We will notify you of significant changes
          by updating the date at the top of this page. Continued use of Uyra after changes are posted
          constitutes your acceptance of the revised policy.
        </Section>

        <Section title="Contact Us">
          If you have questions about this Privacy Policy or how we handle your data, please contact us at{' '}
          <a href="mailto:hello@uyra.ai" className="text-[#f8f8f8] underline underline-offset-2 hover:text-white">
            hello@uyra.ai
          </a>.
        </Section>

        {/* Footer nav */}
        <div className="pt-4 flex gap-6 text-xs text-[#555]">
          <Link href="/terms" className="hover:text-[#f8f8f8] transition-colors duration-200">Terms of Service</Link>
          <Link href="/" className="hover:text-[#f8f8f8] transition-colors duration-200">Back to Uyra</Link>
        </div>

      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[#f8f8f8] text-sm font-semibold tracking-tight">{title}</h2>
      <div className="text-[#999] text-sm leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}
