import { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getCountryContent } from '@/lib/supplier-landing-content';
import { PortalNavbar } from '@/components/supplier-landing/PortalNavbar';
import { PortalHeroSection } from '@/components/supplier-landing/PortalHeroSection';
import { WhyCardsGrid } from '@/components/supplier-landing/WhyCardsGrid';
import { SupplierProfileSection } from '@/components/supplier-landing/SupplierProfileSection';
import { RegistrationSection } from '@/components/supplier-landing/RegistrationSection';
import { FooterSection } from '@/components/supplier-landing/FooterSection';
import { WhatsAppFloatingButton } from '@/components/supplier-landing/WhatsAppFloatingButton';
import { HelmetProvider, Helmet } from 'react-helmet-async';

export default function SupplierLanding() {
  const { country } = useParams<{ country?: string }>();
  const content = getCountryContent(country);
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <HelmetProvider>
      <Helmet>
        <title>Become a Supplier | Graven Automation Private Limited</title>
        <meta 
          name="description" 
          content={`Register as a supplier with Graven Automation. ${content.subheadline}. Join our network of trusted industrial automation suppliers.`}
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://gravenautomation.com/supplier-register${country ? `/${country}` : ''}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={`${content.headline} | Graven Automation`} />
        <meta property="og:description" content={content.subheadline} />
        <meta property="og:type" content="website" />
        
        {/* Country-specific tags */}
        {country && <meta name="geo.region" content={content.code} />}
      </Helmet>

      <div className="min-h-screen bg-[#010409]">
        <PortalNavbar />
        <PortalHeroSection content={content} onScrollToForm={scrollToForm} />
        <WhyCardsGrid />
        <SupplierProfileSection />
        <RegistrationSection ref={formRef} content={content} countrySlug={country} />
        <FooterSection />
        <WhatsAppFloatingButton />
      </div>
    </HelmetProvider>
  );
}
