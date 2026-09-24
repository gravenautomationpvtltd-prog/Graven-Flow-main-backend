import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { RFQItemRow } from '@/components/supplier-network/RFQItemRow';
import type { RFQItemFormData, RFQItemSpec } from '@/hooks/useRFQItems';
import type { Json } from '@/integrations/supabase/types';
import { useTranslation } from '@/lib/i18n';

const emptyItem = (): RFQItemFormData => ({
  description: '', quantity: 1, unit: 'Nos', target_price: null,
  specifications: {} as RFQItemSpec, sort_order: 0,
});

export default function CreateRFQ() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [title, setTitle] = useState('');
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [department, setDepartment] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [commercialTerms, setCommercialTerms] = useState('');
  const [items, setItems] = useState<RFQItemFormData[]>([emptyItem()]);

  const { data: categories = [] } = useQuery({
    queryKey: ['supplier-categories'],
    queryFn: async () => { const { data } = await supabase.from('supplier_categories').select('*').eq('is_active', true); return data || []; },
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => { const { data } = await supabase.from('currencies').select('*').eq('is_active', true); return data || []; },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: rfq, error: rfqError } = await supabase.from('rfqs').insert({
        title, project_name: projectName || null, client_name: clientName || null,
        department: department || null, category_id: categoryId || null, base_currency: baseCurrency,
        deadline_date: deadline, description: description || null, commercial_terms: commercialTerms || null,
        created_by: profile?.id, rfq_number: '',
      }).select('id').single();
      if (rfqError) throw rfqError;

      const validItems = items.filter((i) => i.description.trim());
      if (validItems.length > 0) {
        const rows = validItems.map((item, idx) => ({
          rfq_id: rfq.id, description: item.description, quantity: item.quantity,
          unit: item.unit || 'Nos', target_price: item.target_price,
          specifications: item.specifications as unknown as Json, sort_order: idx + 1,
        }));
        const { error: itemsError } = await supabase.from('rfq_items').insert(rows);
        if (itemsError) throw itemsError;
      }
      return rfq;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rfqs'] }); toast.success(t('toast.created', 'Created successfully')); navigate('/supplier-network/rfqs'); },
    onError: (err: Error) => { toast.error(err.message || t('toast.error', 'Something went wrong')); },
  });

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, item: RFQItemFormData) => { const updated = [...items]; updated[idx] = item; setItems(updated); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/supplier-network/rfqs')}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('action.create', 'Create')} RFQ</h1>
          <p className="text-muted-foreground">{t('supplier_network.rfqs', 'RFQs')}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>RFQ {t('field.description', 'Details')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="RFQ title" /></div>
            <div><Label>Project {t('field.name', 'Name')}</Label><Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project reference" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Client {t('field.name', 'Name')}</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Optional client" /></div>
            <div><Label>{t('employees.department', 'Department')}</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Requesting dept" /></div>
            <div>
              <Label>{t('products.category', 'Category')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder={`${t('action.select', 'Select')}...`} /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('quotations.currency', 'Currency')}</Label>
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Deadline *</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
          </div>
          <div><Label>{t('field.description', 'Description')}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="General RFQ description..." /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem} type="button"><Plus className="h-4 w-4 mr-1" /> {t('action.add', 'Add')} Item</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 px-3 text-xs font-medium text-muted-foreground">
            <span className="w-8">SR</span>
            <span className="flex-1">{t('field.description', 'Description')}</span>
            <span className="w-20">{t('field.quantity', 'Qty')}</span>
            <span className="w-20">{t('products.unit', 'Unit')}</span>
            <span className="w-28">Target Price</span>
            <span className="w-8">Specs</span>
            <span className="w-8"></span>
          </div>
          {items.map((item, idx) => (
            <RFQItemRow key={idx} index={idx} item={item} onChange={(updated) => updateItem(idx, updated)} onRemove={() => removeItem(idx)} />
          ))}
          {items.length === 0 && <p className="text-center text-muted-foreground py-8">{t('action.no_results', 'No results found')}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Commercial Terms</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={commercialTerms} onChange={(e) => setCommercialTerms(e.target.value)} placeholder="Payment terms, delivery location, required documents, etc." className="min-h-[100px]" />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/supplier-network/rfqs')}>{t('action.cancel', 'Cancel')}</Button>
        <Button onClick={() => createMutation.mutate()} disabled={!title || !deadline || createMutation.isPending}>
          {createMutation.isPending ? t('action.saving', 'Saving...') : `${t('action.create', 'Create')} RFQ`}
        </Button>
      </div>
    </div>
  );
}
