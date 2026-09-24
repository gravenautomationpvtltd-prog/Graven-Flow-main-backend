import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { 
  Zap, 
  DollarSign, 
  CreditCard, 
  Snowflake,
  Star,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { OverridePricingDialog } from './OverridePricingDialog';
import { ChangeCreditTermsDialog } from './ChangeCreditTermsDialog';
import { FreezeEntityDialog } from './FreezeEntityDialog';
import { SetPriorityDialog } from './SetPriorityDialog';

export function QuickActionsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Dialog states
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);

  const quickActions = [
    {
      icon: DollarSign,
      label: 'Override Pricing',
      description: 'Apply special discount for customer',
      onClick: () => setPricingDialogOpen(true),
      variant: 'default' as const,
    },
    {
      icon: CreditCard,
      label: 'Change Credit Terms',
      description: 'Modify credit limit & payment days',
      onClick: () => setCreditDialogOpen(true),
      variant: 'outline' as const,
    },
    {
      icon: Snowflake,
      label: 'Freeze Entity',
      description: 'Freeze customer or SKU',
      onClick: () => setFreezeDialogOpen(true),
      variant: 'outline' as const,
    },
    {
      icon: Star,
      label: 'Set Priority',
      description: 'Mark customer as priority',
      onClick: () => setPriorityDialogOpen(true),
      variant: 'outline' as const,
    },
  ];

  return (
    <>
      {/* Floating Action Button - Mobile */}
      <div className="fixed bottom-4 right-4 z-50 md:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full h-14 w-14 shadow-lg">
              <Zap className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>Executive Actions</SheetTitle>
              <SheetDescription>Quick override controls at your fingertips</SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant}
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                >
                  <action.icon className="h-5 w-5" />
                  <span className="text-xs text-center">{action.label}</span>
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Floating Panel */}
      <div className="fixed bottom-4 right-4 z-50 hidden md:block">
        <Card className={`shadow-xl border-2 transition-all duration-300 ${isExpanded ? 'w-72' : 'w-auto'}`}>
          <CardHeader 
            className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                {isExpanded && (
                  <CardTitle className="text-sm">Executive Actions</CardTitle>
                )}
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          
          {isExpanded && (
            <CardContent className="p-3 pt-0 space-y-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant}
                  size="sm"
                  className="w-full justify-start gap-3 h-auto py-2"
                  onClick={action.onClick}
                >
                  <action.icon className="h-4 w-4 shrink-0" />
                  <div className="text-left">
                    <p className="text-xs font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground font-normal">{action.description}</p>
                  </div>
                </Button>
              ))}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Dialogs */}
      <OverridePricingDialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen} />
      <ChangeCreditTermsDialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen} />
      <FreezeEntityDialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen} />
      <SetPriorityDialog open={priorityDialogOpen} onOpenChange={setPriorityDialogOpen} />
    </>
  );
}
