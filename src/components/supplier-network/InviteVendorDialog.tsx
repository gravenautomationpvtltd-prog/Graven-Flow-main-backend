import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteVendorDialog({ open, onOpenChange }: Props) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/vendor-registration`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  const mailto = `mailto:?subject=${encodeURIComponent('Vendor onboarding – Graven Automation')}&body=${encodeURIComponent(
    `Hi,\n\nPlease register as a vendor using the link below:\n${url}\n\nThank you.`
  )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a new vendor</DialogTitle>
          <DialogDescription>
            Share this link with the supplier. They fill the onboarding form and it appears in Vendor Applications for your approval.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <img src={qr} alt="QR code" className="rounded-md border" width={220} height={220} />
          <div className="flex w-full gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <Button onClick={copy} variant="secondary" size="icon">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2 w-full">
            <Button asChild variant="outline" className="flex-1">
              <a href={mailto}><Mail className="h-4 w-4 mr-2" />Email link</a>
            </Button>
            <Button asChild className="flex-1">
              <a href={url} target="_blank" rel="noreferrer">Open form</a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
