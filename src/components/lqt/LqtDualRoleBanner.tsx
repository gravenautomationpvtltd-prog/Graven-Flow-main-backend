import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Inbox, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const DISMISS_KEY = 'lqt:dual-role-banner-dismissed';

/**
 * Banner shown on the LQT inbox to dual-role (Sales + LQT) users explaining
 * that any lead they create lands here first for qualification, then follows
 * customer-loyalty routing on handoff.
 */
export function LqtDualRoleBanner() {
  const { isCRO, isSales } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (!isCRO || !isSales || dismissed) return null;

  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Inbox className="h-4 w-4 text-primary" />
      <AlertDescription className="flex items-start justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">Dual-role routing:</span>{' '}
          You hold both Sales (SPT) and LQT roles. Any lead you create lands{' '}
          <span className="font-medium">here in your LQT inbox first</span> for
          qualification, then follows customer-loyalty rules on handoff.
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 -mt-1 -mr-1"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
