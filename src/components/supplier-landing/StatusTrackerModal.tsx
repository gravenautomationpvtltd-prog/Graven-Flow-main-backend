import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  FileSearch,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StatusTrackerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApplicationStatus {
  company_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusStages = [
  { key: 'pending', label: 'Submitted', progress: 25 },
  { key: 'under_review', label: 'Technical Review', progress: 50 },
  { key: 'documents_pending', label: 'Documents Review', progress: 60 },
  { key: 'approved', label: 'Approved', progress: 100 },
  { key: 'rejected', label: 'Rejected', progress: 0 },
];

export function StatusTrackerModal({ open, onOpenChange }: StatusTrackerModalProps) {
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!email || !gstNumber) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and GST/Tax number.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setNotFound(false);
    setApplicationStatus(null);

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('name, status, created_at, updated_at')
        .eq('email', email.trim())
        .eq('gst_number', gstNumber.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setApplicationStatus({
          company_name: data.name,
          status: data.status,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
      toast({
        title: "Error",
        description: "Failed to fetch application status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentStage = (status: string) => {
    return statusStages.find(s => s.key === status) || statusStages[0];
  };

  const resetModal = () => {
    setEmail('');
    setGstNumber('');
    setApplicationStatus(null);
    setNotFound(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetModal();
    }}>
      <DialogContent className="sm:max-w-md bg-[#0d1117] border-[#30363d] text-[#e6edf3]">
        <DialogHeader>
          <DialogTitle className="text-[#e6edf3]">Application Tracker</DialogTitle>
          <DialogDescription className="text-[#8b949e]">
            Check the status of your supplier registration application.
          </DialogDescription>
        </DialogHeader>

        {!applicationStatus ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#e6edf3]">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#1c2128] border-[#30363d] text-[#e6edf3] placeholder:text-[#8b949e] focus:border-[#00d2ff]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst" className="text-[#e6edf3]">GST/Tax Number</Label>
              <Input
                id="gst"
                placeholder="Your GST or Tax ID"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="bg-[#1c2128] border-[#30363d] text-[#e6edf3] placeholder:text-[#8b949e] focus:border-[#00d2ff]"
              />
            </div>

            {notFound && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#d29922]/10 border border-[#d29922]/30 text-[#d29922] text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>No application found with these details. Please check and try again.</span>
              </div>
            )}

            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full bg-[#00d2ff] text-[#010409] hover:bg-[#00d2ff]/90 font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Track Application
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Company info */}
            <div className="p-4 rounded-lg bg-[#1c2128] border border-[#30363d]">
              <p className="text-sm text-[#8b949e]">Company</p>
              <p className="text-lg font-semibold text-[#e6edf3]">{applicationStatus.company_name}</p>
            </div>

            {/* Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8b949e]">Stage:</span>
                <span className={`font-medium ${
                  applicationStatus.status === 'approved' 
                    ? 'text-[#3fb950]' 
                    : applicationStatus.status === 'rejected'
                    ? 'text-red-500'
                    : 'text-[#00d2ff]'
                }`}>
                  {getCurrentStage(applicationStatus.status).label}
                </span>
              </div>
              <Progress 
                value={getCurrentStage(applicationStatus.status).progress} 
                className="h-2 bg-[#30363d]"
              />
            </div>

            {/* Status icon and message */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-[#1c2128] border border-[#30363d]">
              {applicationStatus.status === 'approved' ? (
                <CheckCircle2 className="w-5 h-5 text-[#3fb950] flex-shrink-0 mt-0.5" />
              ) : applicationStatus.status === 'rejected' ? (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              ) : (
                <FileSearch className="w-5 h-5 text-[#00d2ff] flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm text-[#e6edf3]">
                  {applicationStatus.status === 'approved' 
                    ? 'Congratulations! Your application has been approved.' 
                    : applicationStatus.status === 'rejected'
                    ? 'Unfortunately, your application was not approved.'
                    : 'Our team is reviewing your application and documents.'
                  }
                </p>
                <p className="text-xs text-[#8b949e] mt-1">
                  Last updated: {new Date(applicationStatus.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Search again button */}
            <Button
              variant="outline"
              onClick={resetModal}
              className="w-full bg-transparent border-[#30363d] text-[#e6edf3] hover:bg-[#1c2128] hover:border-[#00d2ff]"
            >
              <Search className="w-4 h-4 mr-2" />
              Search Another Application
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
