import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CountryContent } from '@/lib/supplier-landing-content';
import { 
  TrendingUp, 
  Clock, 
  Shield, 
  Users, 
  FileCheck, 
  Banknote,
  CheckCircle2
} from 'lucide-react';

interface BenefitsSectionProps {
  content: CountryContent;
}

export function BenefitsSection({ content }: BenefitsSectionProps) {
  const generalBenefits = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Growing Market',
      description: "India's industrial automation market is expanding rapidly, offering consistent demand for quality products.",
    },
    {
      icon: <Banknote className="w-6 h-6" />,
      title: 'Reliable Payments',
      description: 'We maintain strict payment schedules and offer flexible terms to support your business needs.',
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: 'Quick Onboarding',
      description: 'Our streamlined registration process gets you started within days, not weeks.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Transparent Process',
      description: 'Clear communication, fair negotiations, and professional procurement practices.',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Dedicated Support',
      description: 'Our procurement team provides personalized support for all supplier partners.',
    },
    {
      icon: <FileCheck className="w-6 h-6" />,
      title: 'Easy Documentation',
      description: 'Simple paperwork requirements with digital document submission and verification.',
    },
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="container px-4">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Benefits</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Partner With Us?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join a network of trusted suppliers and grow your business with Graven Automation
            </p>
          </div>

          {/* Country-specific benefits */}
          <Card className="mb-12 border-primary/20 bg-primary/5">
            <CardContent className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-2xl">{content.flag}</span>
                <h3 className="text-xl font-semibold">
                  Special Benefits for {content.name} Suppliers
                </h3>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* General benefits grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {generalBenefits.map((benefit, index) => (
              <Card 
                key={index} 
                className="hover:border-primary/50 hover:shadow-md transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                    {benefit.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
