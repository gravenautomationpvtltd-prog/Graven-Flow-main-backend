import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />
      <main className="max-w-3xl mx-auto px-4 pt-28 pb-16 space-y-6">
        <h1 className="text-3xl font-bold">Refund Policy</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        <p className="text-muted-foreground leading-relaxed">
          We want you to be satisfied with Graven OneDesk. If you are not happy with your subscription, you may request a refund within the terms outlined below.
        </p>
        <h2 className="text-xl font-semibold pt-4">Eligibility</h2>
        <p className="text-muted-foreground leading-relaxed">Refund requests must be made within 14 days of the initial subscription purchase. Renewals are non-refundable unless otherwise required by law.</p>
        <h2 className="text-xl font-semibold pt-4">How to Request a Refund</h2>
        <p className="text-muted-foreground leading-relaxed">To request a refund, please contact our support team at support@gravenonedesk.com with your account details and reason for the request.</p>
        <h2 className="text-xl font-semibold pt-4">Processing</h2>
        <p className="text-muted-foreground leading-relaxed">Approved refunds will be processed within 7-10 business days to the original payment method.</p>
      </main>
      <LandingFooter />
    </div>
  );
}
