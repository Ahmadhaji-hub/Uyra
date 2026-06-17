import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Uyra',
  description: 'Terms and conditions for using the Uyra service.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* Header */}
        <div className="space-y-2">
          <Link href="/" className="text-[#555] text-xs hover:text-[#f8f8f8] transition-colors duration-200">
            ← uyra.ai
          </Link>
          <h1 className="text-[#f8f8f8] text-2xl font-semibold tracking-tight pt-4">Terms of Service</h1>
          <p className="text-[#555] text-sm">Last updated: June 2025</p>
        </div>

        <Section title="Acceptance of Terms">
          By accessing or using Uyra at uyra.ai (the &quot;Service&quot;), you agree to be bound by these Terms
          of Service (&quot;Terms&quot;). If you do not agree to these Terms, please do not use the Service.
          These Terms constitute a legally binding agreement between you and Uyra (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;).
        </Section>

        <Section title="Description of Service">
          Uyra is a personal AI operating system that helps you understand and manage your digital life,
          starting with email inbox intelligence. The Service connects to your Google account with your
          explicit permission to analyse communication patterns and surface actionable insights.
          Uyra is currently in early access / beta. Features may change at any time.
        </Section>

        <Section title="Eligibility">
          You must be at least 13 years old to use this Service. By using Uyra, you represent and
          warrant that you meet this age requirement and have the legal capacity to enter into these Terms.
          If you are using Uyra on behalf of an organisation, you represent that you have authority to
          bind that organisation to these Terms.
        </Section>

        <Section title="Google Account and OAuth Permissions">
          <p>
            Uyra uses Google OAuth to authenticate you and, optionally, to access your Gmail inbox.
            By connecting your Gmail account, you grant Uyra permission to:
          </p>
          <ul className="mt-3 space-y-2 text-[#999] text-sm">
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Read your Gmail message metadata (From, To, Subject, Date headers) in a read-only capacity</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Process this metadata on-demand to generate inbox analysis</li>
          </ul>
          <p className="mt-4">
            You may revoke this permission at any time via your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f8f8f8] underline underline-offset-2 hover:text-white"
            >
              Google Account permissions
            </a>.
            Uyra will never modify, delete, send, or compose emails on your behalf.
          </p>
        </Section>

        <Section title="Acceptable Use">
          <p>You agree not to:</p>
          <ul className="mt-3 space-y-2 text-[#999] text-sm">
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Attempt to gain unauthorised access to any part of the Service or its infrastructure</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Interfere with or disrupt the integrity or performance of the Service</li>
            <li className="flex gap-2"><span className="text-[#555] shrink-0">—</span>Use the Service to process data belonging to others without their consent</li>
          </ul>
        </Section>

        <Section title="Intellectual Property">
          All content, design, code, and materials comprising the Uyra Service are owned by Uyra and are
          protected by applicable intellectual property laws. You are granted a limited, non-exclusive,
          non-transferable licence to access and use the Service solely for your personal, non-commercial
          purposes. Nothing in these Terms transfers any intellectual property rights to you.
        </Section>

        <Section title="Privacy">
          Your use of the Service is also governed by our{' '}
          <Link href="/privacy" className="text-[#f8f8f8] underline underline-offset-2 hover:text-white">
            Privacy Policy
          </Link>
          , which is incorporated into these Terms by reference. By using the Service, you consent
          to the data practices described in our Privacy Policy.
        </Section>

        <Section title="Disclaimer of Warranties">
          The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind,
          express or implied. We do not warrant that the Service will be uninterrupted, error-free,
          or completely secure. We disclaim all warranties, including implied warranties of merchantability,
          fitness for a particular purpose, and non-infringement to the fullest extent permitted by law.
        </Section>

        <Section title="Limitation of Liability">
          To the maximum extent permitted by applicable law, Uyra shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, including loss of data or profits,
          arising out of or related to your use of the Service, even if we have been advised of the
          possibility of such damages. Our total liability to you for any claims arising from these Terms
          or the Service shall not exceed the amount you paid us in the twelve months preceding the claim.
        </Section>

        <Section title="Termination">
          We reserve the right to suspend or terminate your access to the Service at any time, with or
          without notice, if we believe you have violated these Terms or for any other operational reason.
          You may stop using the Service at any time. Upon termination, your right to access the Service
          ceases immediately.
        </Section>

        <Section title="Changes to Terms">
          We may revise these Terms from time to time. We will indicate the date of the most recent
          revision at the top of this page. Your continued use of the Service after changes are posted
          constitutes acceptance of the revised Terms. If you do not agree to the revised Terms,
          please stop using the Service.
        </Section>

        <Section title="Governing Law">
          These Terms are governed by and construed in accordance with applicable law. Any disputes
          arising from or related to these Terms or the Service shall be resolved through good-faith
          negotiation. If negotiation fails, disputes shall be subject to binding arbitration or
          the jurisdiction of the courts in the applicable territory.
        </Section>

        <Section title="Contact">
          For questions about these Terms, please contact us at{' '}
          <a href="mailto:hello@uyra.ai" className="text-[#f8f8f8] underline underline-offset-2 hover:text-white">
            hello@uyra.ai
          </a>.
        </Section>

        {/* Footer nav */}
        <div className="pt-4 flex gap-6 text-xs text-[#555]">
          <Link href="/privacy" className="hover:text-[#f8f8f8] transition-colors duration-200">Privacy Policy</Link>
          <Link href="/" className="hover:text-[#f8f8f8] transition-colors duration-200">Back to Uyra</Link>
        </div>

      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[#f8f8f8] text-sm font-semibold tracking-tight">{title}</h2>
      <div className="text-[#999] text-sm leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}
