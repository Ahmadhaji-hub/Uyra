import Nav from '@/components/Nav'
import HeroSection from '@/components/HeroSection'
import ProblemSection from '@/components/ProblemSection'
import IdentityLayer from '@/components/IdentityLayer'
import HowItWorks from '@/components/HowItWorks'
import DemoSection from '@/components/DemoSection'
import MeetYouraSection from '@/components/MeetYouraSection'
import FutureSection from '@/components/FutureSection'
import WaitlistSection from '@/components/WaitlistSection'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] overflow-x-hidden">
      <Nav />
      <HeroSection />
      <ProblemSection />
      <IdentityLayer />
      <HowItWorks />
      <DemoSection />
      <MeetYouraSection />
      <FutureSection />
      <WaitlistSection />
      <Footer />
    </main>
  )
}
