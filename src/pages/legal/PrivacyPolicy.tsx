import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />
      <main className="max-w-3xl mx-auto px-4 pt-28 pb-16 space-y-6">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        <p className="text-muted-foreground leading-relaxed">
          At Graven OneDesk, we are committed to protecting your personal information and your right to privacy. This policy describes how we collect, use, and share information when you use our platform.
        </p>
        <h2 className="text-xl font-semibold pt-4">Information We Collect</h2>
        <p className="text-muted-foreground leading-relaxed">We collect personal information that you voluntarily provide when registering, using our services, or contacting us. This may include name, email address, phone number, company details, and billing information.</p>
        <h2 className="text-xl font-semibold pt-4">How We Use Your Information</h2>
        <p className="text-muted-foreground leading-relaxed">We use the information we collect to provide, maintain, and improve our services, communicate with you, and ensure the security of our platform.</p>
        <h2 className="text-xl font-semibold pt-4">Contact Us</h2>
        <p className="text-muted-foreground leading-relaxed">If you have questions about this policy, please contact us at support@gravenonedesk.com.</p>
      </main>
      <LandingFooter />
    </div>
  );
}
