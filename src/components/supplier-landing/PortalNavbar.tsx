import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import gravenLogo from '@/assets/graven-logo.png';
import { StatusTrackerModal } from './StatusTrackerModal';

interface PortalNavbarProps {
  onScrollToForm?: () => void;
}

export function PortalNavbar({ onScrollToForm }: PortalNavbarProps) {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[#30363d] bg-[#0d1117]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img 
                src={gravenLogo} 
                alt="Graven Automation" 
                className="h-8 object-contain"
              />
              <span className="font-extrabold text-lg text-[#00d2ff] hidden sm:block">
                GRAVEN ONEDESK
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStatusModalOpen(true)}
                className="bg-transparent border-[#30363d] text-[#e6edf3] hover:bg-[#1c2128] hover:text-[#00d2ff] hover:border-[#00d2ff]"
              >
                <Search className="w-4 h-4 mr-2" />
                Track Status
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <StatusTrackerModal 
        open={isStatusModalOpen} 
        onOpenChange={setIsStatusModalOpen} 
      />
    </>
  );
}
