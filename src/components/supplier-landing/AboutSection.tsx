import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { companyInfo } from '@/lib/supplier-landing-content';
import { Award, CheckCircle2, Package, Users, MapPin, Building } from 'lucide-react';

export function AboutSection() {
  const iconMap: Record<string, React.ReactNode> = {
    'Years in Business': <Award className="w-6 h-6" />,
    'Products Distributed': <Package className="w-6 h-6" />,
    'Clients Served': <Users className="w-6 h-6" />,
    'Cities Covered': <MapPin className="w-6 h-6" />,
  };

  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container px-4">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">About Us</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {companyInfo.name}
            </h2>
            <p className="text-xl text-muted-foreground">
              {companyInfo.tagline}
            </p>
          </div>

          {/* Description */}
          <Card className="mb-12">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building className="w-6 h-6 text-primary" />
                </div>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {companyInfo.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {companyInfo.stats.map((stat) => (
              <Card key={stat.label} className="text-center hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
                    {iconMap[stat.label]}
                  </div>
                  <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Expertise areas */}
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-6">Our Product Categories</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {companyInfo.expertise.map((item) => (
                <div 
                  key={item}
                  className="flex items-center gap-2 bg-background border rounded-full px-4 py-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
