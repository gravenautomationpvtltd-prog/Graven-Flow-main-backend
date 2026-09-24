import { companyInfo, supportedCountries } from '@/lib/supplier-landing-content';
import { Mail, Phone, MapPin, Globe, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import gravenLogo from '@/assets/graven-logo.png';

export function FooterSection() {
  return (
    <footer className="bg-[#0d1117] border-t border-[#30363d]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Company info */}
          <div className="space-y-4">
            <img 
              src={gravenLogo} 
              alt="Graven Automation" 
              className="h-10 object-contain"
            />
            <p className="text-sm text-[#8b949e]">
              {companyInfo.tagline}
            </p>
          </div>

          {/* Contact info */}
          <div className="space-y-4">
            <h4 className="font-semibold text-[#e6edf3]">Contact Us</h4>
            <div className="space-y-3 text-sm">
              <a 
                href={`mailto:${companyInfo.contactEmail}`}
                className="flex items-center gap-2 text-[#8b949e] hover:text-[#00d2ff] transition-colors"
              >
                <Mail className="w-4 h-4" />
                {companyInfo.contactEmail}
              </a>
              <a 
                href="https://wa.me/917905350134"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#8b949e] hover:text-[#25D366] transition-colors"
              >
                <Phone className="w-4 h-4" />
                +91 7905350134
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
              </a>
              <a 
                href="https://wa.me/919919089567"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#8b949e] hover:text-[#25D366] transition-colors"
              >
                <Phone className="w-4 h-4" />
                +91 9919089567
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
              </a>
              <div className="flex items-center gap-2 text-[#8b949e]">
                <MapPin className="w-4 h-4" />
                {companyInfo.address}
              </div>
            </div>
          </div>

          {/* Supplier countries */}
          <div className="space-y-4">
            <h4 className="font-semibold text-[#e6edf3] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#00d2ff]" />
              Supplier Regions
            </h4>
            <div className="flex flex-wrap gap-2">
              {supportedCountries.map((country) => (
                <Link
                  key={country.slug}
                  to={`/supplier-register/${country.slug}`}
                  className="inline-flex items-center gap-1 text-xs bg-[#1c2128] border border-[#30363d] rounded-full px-3 py-1 hover:border-[#00d2ff]/50 hover:text-[#00d2ff] transition-colors text-[#e6edf3]"
                >
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#30363d] pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#8b949e]">
          <p>© {new Date().getFullYear()} {companyInfo.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
