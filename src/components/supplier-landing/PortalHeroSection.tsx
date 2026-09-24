import { Button } from '@/components/ui/button';
import { ArrowDown, Building2 } from 'lucide-react';
import type { CountryContent } from '@/lib/supplier-landing-content';

interface PortalHeroSectionProps {
  content: CountryContent;
  onScrollToForm: () => void;
}

export function PortalHeroSection({ content, onScrollToForm }: PortalHeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-[#010409]">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00d2ff]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00d2ff]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 text-center">
        {/* Country badge */}
        {content.code !== 'INTL' && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1c2128] border border-[#30363d] mb-6">
            <span className="text-xl">{content.flag}</span>
            <span className="text-sm text-[#8b949e]">{content.greeting}</span>
          </div>
        )}

        {/* Main heading */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#e6edf3] mb-6 tracking-tight">
          SUPPLIER REGISTRATION
        </h1>

        {/* Tagline */}
        <p className="text-xl md:text-2xl font-medium text-[#00d2ff] mb-4">
          Build Once. Supply Globally. Scale with Graven.
        </p>

        {/* Description */}
        <p className="text-lg text-[#8b949e] max-w-2xl mx-auto mb-10">
          Join our verified global supplier ecosystem for industrial automation and engineered products.
        </p>

        {/* CTA Button */}
        <Button
          onClick={onScrollToForm}
          size="lg"
          className="bg-[#00d2ff] text-[#010409] hover:bg-[#00d2ff]/90 font-bold text-lg px-10 py-6 rounded-lg shadow-lg shadow-[#00d2ff]/20 transition-all hover:shadow-xl hover:shadow-[#00d2ff]/30"
        >
          <Building2 className="w-5 h-5 mr-2" />
          Apply for Supplier Registration
          <ArrowDown className="w-5 h-5 ml-2 animate-bounce" />
        </Button>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          {[
            { value: '200+', label: 'Active Suppliers' },
            { value: '15+', label: 'Countries' },
            { value: '99.9%', label: 'Payment Rate' },
            { value: '48hrs', label: 'Avg Response' },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-[#00d2ff]">{stat.value}</div>
              <div className="text-sm text-[#8b949e]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
