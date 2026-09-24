import { Button } from '@/components/ui/button';
import { ArrowDown, Building2, Globe, Handshake } from 'lucide-react';
import type { CountryContent } from '@/lib/supplier-landing-content';
import gravenLogo from '@/assets/graven-logo.png';

interface HeroSectionProps {
  content: CountryContent;
  onScrollToForm: () => void;
}

export function HeroSection({ content, onScrollToForm }: HeroSectionProps) {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <div className="container relative z-10 px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img 
              src={gravenLogo} 
              alt="Graven Automation" 
              className="h-16 md:h-20 object-contain"
            />
          </div>

          {/* Greeting badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            <span className="text-lg">{content.flag}</span>
            <span>{content.greeting}</span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
            {content.headline}
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            {content.subheadline}
          </p>

          {/* Value props */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            <div className="flex flex-col items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium">Global Reach</span>
              <span className="text-sm text-muted-foreground text-center">
                Access India's growing industrial market
              </span>
            </div>
            <div className="flex flex-col items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Handshake className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium">Fair Partnership</span>
              <span className="text-sm text-muted-foreground text-center">
                Transparent dealings & reliable payments
              </span>
            </div>
            <div className="flex flex-col items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium">Long-term Growth</span>
              <span className="text-sm text-muted-foreground text-center">
                Build lasting business relationships
              </span>
            </div>
          </div>

          {/* CTA Button */}
          <div className="pt-8">
            <Button 
              size="lg" 
              onClick={onScrollToForm}
              className="text-lg px-8 py-6 gap-2"
            >
              Register as Supplier
              <ArrowDown className="w-5 h-5 animate-bounce" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
