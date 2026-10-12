import { useState } from 'react';
import { Phone, Mail, ShoppingCart, Sparkles } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCreateActivity } from '@/hooks/useActivities';
import { useSalesOrderByLead } from '@/hooks/useSalesOrders';
import { SendWhatsAppDialog } from './SendWhatsAppDialog';
import { CreateQuotationDialog } from '@/components/quotations/CreateQuotationDialog';
import { RecordOrderDialog } from './RecordOrderDialog';
import { CallQRCodeDialog } from './CallQRCodeDialog';
import { LqtWorkflowModal } from '@/components/lqt/LqtWorkflowModal';
import { QualifyLeadDialog } from './QualifyLeadDialog';
import { useTranslation } from '@/lib/i18n';

interface LeadActionsProps {
  leadId: string;
  customerId?: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerName?: string;
  lead?: any;
  onAddNote: () => void;
  onCreateTask: () => void;
}

interface ActionIconProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  color: string;
}

function ActionIcon({ icon, label, onClick, disabled, disabledReason, color }: ActionIconProps) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border/50 transition-all duration-200 hover:shadow-md ${
        disabled 
          ? 'opacity-40 cursor-not-allowed bg-muted/30' 
          : 'hover:border-primary/30 hover:bg-accent/50 cursor-pointer'
      }`}
    >
      <div className={`p-3 rounded-full ${color}`}>
        {icon}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </button>
  );

  if (disabled && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

export function LeadActions({ leadId, customerId, customerPhone, customerEmail, customerName, lead, onAddNote, onCreateTask }: LeadActionsProps) {
  const { t } = useTranslation();
  const createActivity = useCreateActivity();
  const { data: existingOrder } = useSalesOrderByLead(leadId);
  const [sendWhatsAppOpen, setSendWhatsAppOpen] = useState(false);
  const [createQuotationOpen, setCreateQuotationOpen] = useState(false);
  const [recordOrderOpen, setRecordOrderOpen] = useState(false);
  const [callQROpen, setCallQROpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [qualifyOpen, setQualifyOpen] = useState(false);

  const handleCall = () => {
    if (customerPhone) {
      setCallQROpen(true);
    }
  };

  const logCallActivity = async () => {
    await createActivity.mutateAsync({
      lead_id: leadId,
      activity_type: 'call',
      description: 'Phone call initiated',
    });
  };

  const handleWhatsApp = async () => {
    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      // Only add 91 if not already present
      const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
      const whatsappUrl = `https://wa.me/${phoneWithCountry}`;
      window.open(whatsappUrl, '_blank');
    }
    await createActivity.mutateAsync({
      lead_id: leadId,
      activity_type: 'whatsapp',
      description: 'WhatsApp message sent',
    });
  };

  const handleEmail = async () => {
    if (customerEmail) {
      window.open(`mailto:${customerEmail}`, '_blank');
    }
    await createActivity.mutateAsync({
      lead_id: leadId,
      activity_type: 'email',
      description: 'Email initiated',
    });
  };

  return (
    <Card className="shadow-sm border-border/50 rounded-xl overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <CardTitle className="text-sm font-semibold">{t('leads.quick_actions', 'Quick Actions')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {/* Core LQT Workflow: Customer Form, Payment & TST */}
        <Button
          size="sm"
          className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-700 hover:to-primary/90 text-white font-medium text-xs h-9 shadow-sm"
          onClick={() => setWorkflowOpen(true)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          LQT Workflow: Form & Payment
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <ActionIcon
            icon={<Phone className="h-5 w-5 text-blue-600" />}
            label={t('leads.call', 'Call')}
            onClick={handleCall}
            disabled={!customerPhone}
            disabledReason={t('leads.no_phone', 'No phone number')}
            color="bg-blue-500/10"
          />
          <ActionIcon
            icon={<WhatsAppIcon className="h-5 w-5 text-green-600" />}
            label={t('leads.whatsapp', 'WhatsApp')}
            onClick={handleWhatsApp}
            disabled={!customerPhone}
            disabledReason={t('leads.no_phone', 'No phone number')}
            color="bg-green-500/10"
          />
          <ActionIcon
            icon={<Mail className="h-5 w-5 text-sky-600" />}
            label={t('field.email', 'Email')}
            onClick={handleEmail}
            disabled={!customerEmail}
            disabledReason={t('leads.no_email', 'No email address')}
            color="bg-sky-500/10"
          />
          <ActionIcon
            icon={<ShoppingCart className="h-5 w-5 text-emerald-600" />}
            label={t('leads.record_order', 'Record Order')}
            onClick={() => setRecordOrderOpen(true)}
            disabled={!!existingOrder}
            disabledReason={t('leads.order_recorded', 'Order already recorded')}
            color="bg-emerald-500/10"
          />
        </div>
      </CardContent>

      <SendWhatsAppDialog
        open={sendWhatsAppOpen}
        onOpenChange={setSendWhatsAppOpen}
        leadId={leadId}
        customerPhone={customerPhone}
        customerName={customerName}
      />

      <CreateQuotationDialog
        open={createQuotationOpen}
        onOpenChange={setCreateQuotationOpen}
        leadId={leadId}
        customerId={customerId}
        customerName={customerName}
        customerPhone={customerPhone || undefined}
        customerEmail={customerEmail || undefined}
      />

      <RecordOrderDialog
        open={recordOrderOpen}
        onOpenChange={setRecordOrderOpen}
        leadId={leadId}
        customerId={customerId}
        customerName={customerName}
      />

      <CallQRCodeDialog
        open={callQROpen}
        onOpenChange={setCallQROpen}
        phoneNumber={customerPhone || ''}
        customerName={customerName}
        onLogActivity={logCallActivity}
      />

      {workflowOpen && (
        <LqtWorkflowModal
          open={workflowOpen}
          onOpenChange={setWorkflowOpen}
          lead={lead || { id: leadId, customer_id: customerId, customer: { phone: customerPhone, email: customerEmail, contact_person: customerName } }}
          onOpenQualifyDialog={() => setQualifyOpen(true)}
        />
      )}

      {qualifyOpen && (
        <QualifyLeadDialog
          open={qualifyOpen}
          onOpenChange={setQualifyOpen}
          leadId={leadId}
        />
      )}
    </Card>
  );
}
