import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />
      <main className="max-w-3xl mx-auto px-4 pt-28 pb-16 space-y-6">
        <h1 className="text-3xl font-bold">About Us</h1>
        <p className="text-muted-foreground leading-relaxed">
          Graven OneDesk is a comprehensive business management platform built to simplify operations for teams of all sizes. From lead management and procurement to invoicing and payroll, we bring every critical function into one unified workspace.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Our mission is to empower businesses to operate efficiently without juggling multiple tools. Whether you're a small startup or a large enterprise, Graven OneDesk scales with your needs.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          We believe in transparency, reliability, and continuous improvement — building features that truly matter for modern businesses.
        </p>
      </main>
      <LandingFooter />
    </div>
  );
}
