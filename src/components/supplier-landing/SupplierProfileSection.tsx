import { portalConfig } from '@/lib/supplier-landing-content';
import { 
  Cpu, 
  Bot, 
  Zap, 
  Cable, 
  Radio, 
  CircuitBoard, 
  Cog, 
  Compass, 
  Factory, 
  Truck,
  FileCheck,
  AlertCircle,
  LucideIcon
} from 'lucide-react';

const categoryIconMap: Record<string, LucideIcon> = {
  Cpu,
  Bot,
  Zap,
  Cable,
  Radio,
  CircuitBoard,
  Cog,
  Compass,
  Factory,
  Truck,
};

export function SupplierProfileSection() {
  return (
    <section className="bg-[#010409] py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 bg-[#090e14] p-8 md:p-12 rounded-2xl border border-[#30363d]">
          {/* Left column - Categories (2/3 width) */}
          <div className="lg:col-span-2">
            <h3 className="text-xl font-bold text-[#e6edf3] mb-6">
              Ideal Supplier Profile
            </h3>
            <p className="text-[#8b949e] mb-6">
              We work with suppliers across these industrial automation categories:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {portalConfig.categories.map((category, index) => {
                const IconComponent = categoryIconMap[category.icon] || Cpu;
                
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-[#1c2128] border border-[#30363d] rounded-lg p-4 transition-all hover:border-[#00d2ff]/50"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#0d1117] flex items-center justify-center text-[#00d2ff]">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-[#e6edf3] font-medium">
                      {category.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column - Prep docs (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="h-full border border-[#d29922] rounded-xl p-6 bg-[#d29922]/5">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-[#d29922]" />
                <h3 className="text-lg font-bold text-[#e6edf3]">
                  What You'll Need
                </h3>
              </div>
              
              <p className="text-sm text-[#8b949e] mb-6">
                Keep these documents ready for a smooth registration:
              </p>

              <ul className="space-y-3">
                {portalConfig.prepDocs.map((doc, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 text-sm text-[#e6edf3]"
                  >
                    <FileCheck className="w-4 h-4 text-[#3fb950] flex-shrink-0" />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
