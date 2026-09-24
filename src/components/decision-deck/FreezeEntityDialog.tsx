import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomers } from '@/hooks/useCustomers';
import { useProductsAdmin } from '@/hooks/useProducts';
import { useFreezeEntity } from '@/hooks/useExecutiveActions';
import { Snowflake, Users, Box, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FreezeEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FreezeEntityDialog({ open, onOpenChange }: FreezeEntityDialogProps) {
  const [entityType, setEntityType] = useState<'customer' | 'product'>('customer');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: productsData, isLoading: productsLoading } = useProductsAdmin();
  const products = productsData?.products;
  const freezeEntity = useFreezeEntity();

  const selectedCustomer = customers?.data?.find(c => c.id === selectedEntityId);
  const selectedProduct = products?.find(p => p.id === selectedEntityId);
  const selectedEntity = entityType === 'customer' ? selectedCustomer : selectedProduct;
  const isFrozen = (selectedEntity as any)?.is_frozen || false;

  const handleSubmit = () => {
    if (!selectedEntityId) return;

    const entityName = entityType === 'customer' 
      ? selectedCustomer?.company_name 
      : selectedProduct?.name;

    freezeEntity.mutate({
      entityType,
      entityId: selectedEntityId,
      entityName: entityName || '',
      freeze: !isFrozen,
      reason,
      notes,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setSelectedEntityId('');
    setReason('');
    setNotes('');
  };

  const handleEntityTypeChange = (value: string) => {
    setEntityType(value as 'customer' | 'product');
    setSelectedEntityId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-blue-500" />
            Freeze / Unfreeze Entity
          </DialogTitle>
          <DialogDescription>
            Freeze a customer or SKU to prevent transactions. Frozen entities are blocked from new orders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Tabs value={entityType} onValueChange={handleEntityTypeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customer" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customer
              </TabsTrigger>
              <TabsTrigger value="product" className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                SKU / Product
              </TabsTrigger>
            </TabsList>

            <TabsContent value="customer" className="mt-4">
              <div className="space-y-2">
                <Label>Select Customer</Label>
                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customersLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      customers?.data?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <div className="flex items-center gap-2">
                            {customer.company_name}
                            {(customer as any)?.is_frozen && (
                              <Badge variant="destructive" className="text-xs">Frozen</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="product" className="mt-4">
              <div className="space-y-2">
                <Label>Select Product / SKU</Label>
                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productsLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex items-center gap-2">
                            {product.name}
                            {(product as any)?.is_frozen && (
                              <Badge variant="destructive" className="text-xs">Frozen</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          {selectedEntity && (
            <div className={`p-3 rounded-lg text-sm ${isFrozen ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800' : 'bg-muted'}`}>
              <div className="flex items-center justify-between">
                <span>
                  <strong>Status:</strong> {isFrozen ? 'Currently Frozen' : 'Active'}
                </span>
                {isFrozen && <Snowflake className="h-4 w-4 text-blue-500" />}
              </div>
              <p className="mt-1 text-muted-foreground">
                {isFrozen 
                  ? 'This entity is frozen and blocked from transactions.' 
                  : 'This entity is active and can transact normally.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {entityType === 'customer' ? (
                  <>
                    <SelectItem value="payment_default">Payment Default</SelectItem>
                    <SelectItem value="credit_breach">Credit Limit Breach</SelectItem>
                    <SelectItem value="disputed_transactions">Disputed Transactions</SelectItem>
                    <SelectItem value="fraud_suspicion">Fraud Suspicion</SelectItem>
                    <SelectItem value="regulatory_compliance">Regulatory Compliance</SelectItem>
                    <SelectItem value="relationship_terminated">Relationship Terminated</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="quality_issue">Quality Issue</SelectItem>
                    <SelectItem value="supplier_problem">Supplier Problem</SelectItem>
                    <SelectItem value="pricing_review">Pricing Under Review</SelectItem>
                    <SelectItem value="dead_stock">Dead Stock Liquidation</SelectItem>
                    <SelectItem value="product_discontinued">Product Discontinued</SelectItem>
                    <SelectItem value="regulatory_compliance">Regulatory Compliance</SelectItem>
                  </>
                )}
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          {!isFrozen && selectedEntity && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Freezing this {entityType} will prevent all new transactions. Existing orders in progress will not be affected.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedEntityId || freezeEntity.isPending}
            variant={isFrozen ? 'default' : 'destructive'}
          >
            {freezeEntity.isPending 
              ? (isFrozen ? 'Unfreezing...' : 'Freezing...') 
              : (isFrozen ? 'Unfreeze' : 'Freeze')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
