import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { RowActions } from './RowActions';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';
import {
  useChartOfAccounts,
  useDeleteExpense,
  useDeleteFixedAsset,
  useExpenses,
  useFixedAssets,
  useSaveExpense,
  useSaveFixedAsset,
} from '@/hooks/useBooks';
import { formatINR } from '@/lib/financial-statements';

function ExpenseDialog({ open, onOpenChange, expense }: { open: boolean; onOpenChange: (o: boolean) => void; expense?: any }) {
  const { data: accounts = [] } = useChartOfAccounts();
  const save = useSaveExpense();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    setForm({
      expense_date: expense?.expense_date ?? new Date().toISOString().slice(0, 10),
      account_id: expense?.account_id ?? '',
      description: expense?.description ?? '',
      vendor_name: expense?.vendor_name ?? '',
      vendor_gstin: expense?.vendor_gstin ?? '',
      bill_number: expense?.bill_number ?? '',
      amount: expense?.amount ?? 0,
      cgst_amount: expense?.cgst_amount ?? 0,
      sgst_amount: expense?.sgst_amount ?? 0,
      igst_amount: expense?.igst_amount ?? 0,
      payment_mode: expense?.payment_mode ?? 'bank',
      is_paid: expense?.is_paid ?? true,
    });
  }, [open, expense]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const expenseAccounts = accounts.filter((a: any) => a.account_type === 'expense');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{expense ? 'Edit expense' : 'Record expense'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.expense_date ?? ''} onChange={(e) => set('expense_date', e.target.value)} />
          </div>
          <div>
            <Label>Expense head</Label>
            <Select value={form.account_id || 'none'} onValueChange={(v) => set('account_id', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Choose head" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Indirect Expenses (default)</SelectItem>
                {expenseAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <Label>Paid to</Label>
            <Input value={form.vendor_name ?? ''} onChange={(e) => set('vendor_name', e.target.value)} />
          </div>
          <div>
            <Label>Vendor GSTIN</Label>
            <Input value={form.vendor_gstin ?? ''} onChange={(e) => set('vendor_gstin', e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Bill number</Label>
            <Input value={form.bill_number ?? ''} onChange={(e) => set('bill_number', e.target.value)} />
          </div>
          <div>
            <Label>Amount (before GST)</Label>
            <Input type="number" value={form.amount ?? 0} onChange={(e) => set('amount', Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>CGST</Label>
            <Input type="number" value={form.cgst_amount ?? 0} onChange={(e) => set('cgst_amount', Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>SGST</Label>
            <Input type="number" value={form.sgst_amount ?? 0} onChange={(e) => set('sgst_amount', Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>IGST</Label>
            <Input type="number" value={form.igst_amount ?? 0} onChange={(e) => set('igst_amount', Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Paid by</Label>
            <Select value={form.payment_mode ?? 'bank'} onValueChange={(v) => set('payment_mode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="exp-paid" checked={!!form.is_paid} onCheckedChange={(v) => set('is_paid', v)} />
            <Label htmlFor="exp-paid">Already paid</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={save.isPending}
            onClick={async () => {
              await save.mutateAsync({ id: expense?.id, expense: { ...form, account_id: form.account_id || null } });
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssetDialog({ open, onOpenChange, asset }: { open: boolean; onOpenChange: (o: boolean) => void; asset?: any }) {
  const save = useSaveFixedAsset();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    setForm({
      name: asset?.name ?? '',
      asset_category: asset?.asset_category ?? '',
      purchase_date: asset?.purchase_date ?? new Date().toISOString().slice(0, 10),
      purchase_value: asset?.purchase_value ?? 0,
      gst_amount: asset?.gst_amount ?? 0,
      depreciation_rate: asset?.depreciation_rate ?? 15,
      vendor_name: asset?.vendor_name ?? '',
      bill_number: asset?.bill_number ?? '',
    });
  }, [open, asset]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{asset ? 'Edit asset' : 'Add asset'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Asset name</Label>
            <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={form.asset_category ?? ''} onChange={(e) => set('asset_category', e.target.value)} placeholder="Vehicle, computer, furniture…" />
          </div>
          <div>
            <Label>Purchase date</Label>
            <Input type="date" value={form.purchase_date ?? ''} onChange={(e) => set('purchase_date', e.target.value)} />
          </div>
          <div>
            <Label>Value (before GST)</Label>
            <Input type="number" value={form.purchase_value ?? 0} onChange={(e) => set('purchase_value', Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>GST</Label>
            <Input type="number" value={form.gst_amount ?? 0} onChange={(e) => set('gst_amount', Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Depreciation rate %</Label>
            <Input type="number" value={form.depreciation_rate ?? 15} onChange={(e) => set('depreciation_rate', Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Bought from</Label>
            <Input value={form.vendor_name ?? ''} onChange={(e) => set('vendor_name', e.target.value)} />
          </div>
          <div>
            <Label>Bill number</Label>
            <Input value={form.bill_number ?? ''} onChange={(e) => set('bill_number', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={save.isPending || !form.name}
            onClick={async () => {
              await save.mutateAsync({ id: asset?.id, asset: form });
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExpensesAssetsTab() {
  const { data: expenses = [] } = useExpenses();
  const { data: assets = [] } = useFixedAssets();
  const delExpense = useDeleteExpense();
  const delAsset = useDeleteFixedAsset();

  const [expOpen, setExpOpen] = useState(false);
  const [expEditing, setExpEditing] = useState<any>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetEditing, setAssetEditing] = useState<any>(null);
  const [expDeleting, setExpDeleting] = useState<any>(null);
  const [assetDeleting, setAssetDeleting] = useState<any>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Expenses</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Rent, salaries, freight, travel and everything else the business spends on.</p>
          </div>
          <Button onClick={() => { setExpEditing(null); setExpOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Record expense</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Head</TableHead><TableHead>Description</TableHead>
                <TableHead>Paid to</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!expenses.length && <TableRow><TableCell colSpan={8}>No expenses recorded yet.</TableCell></TableRow>}
              {expenses.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{e.expense_date}</TableCell>
                  <TableCell>{e.account?.name ?? 'Indirect Expenses'}</TableCell>
                  <TableCell>{e.description ?? '—'}</TableCell>
                  <TableCell>{e.vendor_name ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatINR(Number(e.amount))}</TableCell>
                  <TableCell className="text-right">
                    {formatINR(Number(e.cgst_amount) + Number(e.sgst_amount) + Number(e.igst_amount))}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatINR(Number(e.total_amount))}</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onView={() => { setExpEditing(e); setExpOpen(true); }}
                      onEdit={() => { setExpEditing(e); setExpOpen(true); }}
                      onDelete={() => setExpDeleting(e)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Assets</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Equipment, vehicles and other long-term purchases shown on the balance sheet.</p>
          </div>
          <Button onClick={() => { setAssetEditing(null); setAssetOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add asset</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead><TableHead>Category</TableHead><TableHead>Purchased</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Depreciation %</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!assets.length && <TableRow><TableCell colSpan={6}>No assets recorded yet.</TableCell></TableRow>}
              {assets.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.asset_category ?? '—'}</TableCell>
                  <TableCell>{a.purchase_date}</TableCell>
                  <TableCell className="text-right">{formatINR(Number(a.purchase_value))}</TableCell>
                  <TableCell className="text-right">{Number(a.depreciation_rate)}%</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onView={() => { setAssetEditing(a); setAssetOpen(true); }}
                      onEdit={() => { setAssetEditing(a); setAssetOpen(true); }}
                      onDelete={() => setAssetDeleting(a)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ExpenseDialog open={expOpen} onOpenChange={setExpOpen} expense={expEditing} />
      <AssetDialog open={assetOpen} onOpenChange={setAssetOpen} asset={assetEditing} />

      <DoubleConfirmDeleteDialog
        open={!!expDeleting}
        onOpenChange={(o) => !o && setExpDeleting(null)}
        onConfirm={async () => { if (expDeleting) await delExpense.mutateAsync(expDeleting.id); setExpDeleting(null); }}
        title="Delete expense"
        description="This removes the expense and its entries from the books."
        itemDetails={expDeleting && (
          <>
            <p><strong>Date:</strong> {expDeleting.expense_date}</p>
            <p><strong>Description:</strong> {expDeleting.description ?? '—'}</p>
            <p><strong>Paid to:</strong> {expDeleting.vendor_name ?? '—'}</p>
            <p><strong>Total:</strong> {formatINR(Number(expDeleting.total_amount))}</p>
          </>
        )}
        isLoading={delExpense.isPending}
      />

      <DoubleConfirmDeleteDialog
        open={!!assetDeleting}
        onOpenChange={(o) => !o && setAssetDeleting(null)}
        onConfirm={async () => { if (assetDeleting) await delAsset.mutateAsync(assetDeleting.id); setAssetDeleting(null); }}
        title="Delete asset"
        description="This removes the asset from the balance sheet."
        itemDetails={assetDeleting && (
          <>
            <p><strong>Asset:</strong> {assetDeleting.name}</p>
            <p><strong>Purchased:</strong> {assetDeleting.purchase_date}</p>
            <p><strong>Value:</strong> {formatINR(Number(assetDeleting.purchase_value))}</p>
          </>
        )}
        isLoading={delAsset.isPending}
      />
    </div>
  );
}
