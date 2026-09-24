import { portalConfig } from '@/lib/supplier-landing-content';
import { 
  FileText, 
  Globe, 
  Shield, 
  TrendingUp, 
  Wallet, 
  Handshake,
  LucideIcon
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  FileText,
  Globe,
  Shield,
  TrendingUp,
  Wallet,
  Handshake,
};

export function WhyCardsGrid() {
  return (
    <section className="bg-[#010409] py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-[#e6edf3] mb-4">
            Why Partner with Graven?
          </h2>
          <p className="text-[#8b949e] max-w-2xl mx-auto">
            We've built a supplier ecosystem that prioritizes transparency, growth, and fair business practices.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portalConfig.whyCards.map((card, index) => {
            const IconComponent = iconMap[card.icon] || FileText;
            
            return (
              <div
                key={index}
                className={`
                  group bg-[#0d1117] border rounded-xl p-6 transition-all duration-300
                  hover:border-[#00d2ff] hover:shadow-lg hover:shadow-[#00d2ff]/10
                  ${card.isFeatured 
                    ? 'border-[#00d2ff] shadow-lg shadow-[#00d2ff]/10' 
                    : 'border-[#30363d]'
                  }
                `}
              >
                {/* Icon */}
                <div className={`
                  w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors
                  ${card.isFeatured 
                    ? 'bg-[#00d2ff]/20 text-[#00d2ff]' 
                    : 'bg-[#1c2128] text-[#8b949e] group-hover:bg-[#00d2ff]/20 group-hover:text-[#00d2ff]'
                  }
                `}>
                  <IconComponent className="w-6 h-6" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-[#e6edf3] mb-2">
                  {card.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-[#8b949e] leading-relaxed">
                  {card.desc}
                </p>

                {/* KPIs if present */}
                {card.kpis && (
                  <div className="mt-4 pt-4 border-t border-[#30363d] flex justify-between">
                    {card.kpis.map((kpi, kpiIndex) => (
                      <div key={kpiIndex} className="text-center">
                        <div 
                          className="text-lg font-bold"
                          style={{ color: kpi.color || '#e6edf3' }}
                        >
                          {kpi.val}
                        </div>
                        <div className="text-xs text-[#8b949e]">{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
