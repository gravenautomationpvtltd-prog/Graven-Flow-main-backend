import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />
      <main className="max-w-3xl mx-auto px-4 pt-28 pb-16 space-y-8">
        <h1 className="text-3xl font-bold">Contact Us</h1>
        <p className="text-muted-foreground leading-relaxed">
          Have questions or need support? We'd love to hear from you. Reach out to us through any of the channels below.
        </p>
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Mail className="h-5 w-5 text-primary" />
            <span>support@gravenonedesk.com</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Phone className="h-5 w-5 text-primary" />
            <span>+91-XXXX-XXXXXX</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <MapPin className="h-5 w-5 text-primary" />
            <span>India</span>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
