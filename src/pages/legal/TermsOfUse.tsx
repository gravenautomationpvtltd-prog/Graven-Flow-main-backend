import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />
      <main className="max-w-3xl mx-auto px-4 pt-28 pb-16 space-y-6">
        <h1 className="text-3xl font-bold">Terms of Use</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        <p className="text-muted-foreground leading-relaxed">
          By accessing and using Graven OneDesk, you agree to be bound by these terms and conditions. Please read them carefully before using our platform.
        </p>
        <h2 className="text-xl font-semibold pt-4">Use of Service</h2>
        <p className="text-muted-foreground leading-relaxed">You agree to use Graven OneDesk only for lawful purposes and in accordance with these terms. You are responsible for maintaining the confidentiality of your account credentials.</p>
        <h2 className="text-xl font-semibold pt-4">Intellectual Property</h2>
        <p className="text-muted-foreground leading-relaxed">All content, features, and functionality of Graven OneDesk are owned by us and are protected by intellectual property laws.</p>
        <h2 className="text-xl font-semibold pt-4">Limitation of Liability</h2>
        <p className="text-muted-foreground leading-relaxed">Graven OneDesk shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>
      </main>
      <LandingFooter />
    </div>
  );
}
