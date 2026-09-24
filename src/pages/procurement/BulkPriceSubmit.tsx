import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Send, Loader2, ClipboardPaste, Plus, AlertTriangle } from 'lucide-react';
import { parseBulkPricePaste, rowError, type ParsedPriceRow } from '@/lib/bulk-price-parser';
import { supabase } from '@/integrations/supabase/client';
import { requireTenantId } from '@/utils/tenantUtils';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/lib/i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function BulkPriceSubmit() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<ParsedPriceRow[]>([]);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-min'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, name, country_code').order('name');
      return data || [];
    },
  });

  useEffect(() => {
    const s = suppliers?.find((x: any) => x.id === supplierId);
    if (s) setSupplierName((s as any).name);
  }, [supplierId, suppliers]);

  const parse = () => {
    const parsed = parseBulkPricePaste(raw);
    if (!parsed.length) {
      toast.error('未检测到数据行 / No rows detected');
      return;
    }
    setRows(parsed);
    const bad = parsed.filter(r => r.error).length;
    if (bad) toast.warning(`已解析 ${parsed.length} 行，${bad} 行需要修正 / Parsed ${parsed.length} rows, ${bad} need fixing`);
    else toast.success(`已解析 ${parsed.length} 行 / Parsed ${parsed.length} rows`);
  };

  const updateRow = (i: number, patch: Partial<ParsedPriceRow>) => {
    setRows(rs => rs.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, ...patch };
      return { ...next, error: rowError(next) };
    }));
  };
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i));
  const addRow = () => setRows(rs => [...rs, { raw: '', line_no: rs.length + 1, model_number: '', rmb_price: 0, error: rowError({ model_number: '', rmb_price: 0 }) }]);

  const invalidRows = useMemo(() => rows.filter(r => r.error), [rows]);
  const validRows = useMemo(() => rows.filter(r => !r.error), [rows]);
  const totalCny = useMemo(() => validRows.reduce((s, r) => s + r.rmb_price, 0), [validRows]);



  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');
      if (!supplierName.trim()) throw new Error('供应商必填 / Supplier required');
      if (!rows.length) throw new Error('至少一件商品 / Add at least one item');
      if (invalidRows.length) throw new Error(`${invalidRows.length} 行有错误，请先修正 / ${invalidRows.length} row(s) have errors — fix them first`);
      const tenantId = await requireTenantId();

      const { data: batch, error: bErr } = await supabase
        .from('price_submission_batches')
        .insert({
          tenant_id: tenantId,
          supplier_id: supplierId || null,
          supplier_name: supplierName.trim(),
          submitted_by: user.id,
          status: 'pending_review',
          source_currency: 'CNY',
          raw_paste: raw,
          notes: notes || null,
        } as any)
        .select('id')
        .single();
      if (bErr) throw bErr;

      const items = validRows
        .map((r, idx) => ({
          batch_id: (batch as any).id,
          tenant_id: tenantId,
          line_no: idx + 1,
          raw_text: r.raw,
          item_name: r.model_number,
          model_number: r.model_number,
          qty: 1,
          rmb_price: r.rmb_price,
          cny_unit_price: r.rmb_price,
          source_currency: 'CNY',
        }));
      const { error: iErr } = await supabase.from('price_submission_items').insert(items as any);
      if (iErr) throw iErr;
      return (batch as any).id;
    },
    onSuccess: () => {
      toast.success('已提交给采购审批 / Submitted for approval');
      qc.invalidateQueries({ queryKey: ['price-submission-batches'] });
      setRaw(''); setRows([]); setNotes('');
      navigate('/procurement/bulk-prices');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">
          批量报价 / Bulk Price Submission
        </h1>
        <p className="text-muted-foreground">
          只需粘贴 <b>型号 + RMB 单价</b>，审批人会计算落地价 / Paste model + RMB price only. Approvers compute landed price.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>供应商 / Supplier</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>选择供应商 / Select supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="— 选择 —" /></SelectTrigger>
              <SelectContent>
                {suppliers?.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>供应商名称 / Supplier name</Label>
            <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="e.g. Shenzhen ABC Co., Ltd" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>粘贴报价 / Paste price list</CardTitle>
          <CardDescription>
            每行：<b>型号</b> + <b>RMB 单价</b>（可选数量）。Tab / 空格 / 逗号分隔皆可。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            rows={8}
            placeholder={'GA-XYZ-01\t5600\nGA-XYZ-02\t3200\nGA-ABC-77, 100, 850'}
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={parse} variant="secondary"><ClipboardPaste className="mr-2 h-4 w-4" />解析 / Parse</Button>
            <Button onClick={addRow} variant="outline"><Plus className="mr-2 h-4 w-4" />添加行 / Add row</Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>预览 / Preview</CardTitle>
              <CardDescription>
                {validRows.length} 有效行 / valid · ¥ {totalCny.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {invalidRows.length > 0 && (
                  <span className="text-destructive"> · {invalidRows.length} 行有错误 / row(s) with errors</span>
                )}
              </CardDescription>
            </div>
            <Badge variant="secondary">CNY / RMB</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto space-y-3">
            {invalidRows.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {invalidRows.length} 行无法解析，请在下方修正或删除后再提交 / {invalidRows.length} line(s) failed to parse. Fix or remove them below before submitting.
                </span>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>型号 / Model number</TableHead>
                  
                  <TableHead className="w-32">¥ RMB 单价</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={r.error ? 'bg-destructive/5' : undefined}>
                    <TableCell className="align-top">{i + 1}</TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={r.model_number}
                        onChange={e => updateRow(i, { model_number: e.target.value })}
                        aria-invalid={!!r.error}
                        className={r.error && !r.model_number.trim() ? 'border-destructive focus-visible:ring-destructive' : undefined}
                      />
                      {r.error && (
                        <p className="mt-1 text-xs text-destructive">{r.error}</p>
                      )}
                      {r.error && r.raw && (
                        <p className="mt-0.5 text-xs text-muted-foreground font-mono truncate">原文 / raw: {r.raw}</p>
                      )}
                    </TableCell>
                    
                    <TableCell className="align-top">
                      <Input
                        type="number"
                        step="0.01"
                        value={r.rmb_price}
                        onChange={e => updateRow(i, { rmb_price: parseFloat(e.target.value) || 0 })}
                        aria-invalid={!!r.error}
                        className={r.error && !(r.rmb_price > 0) ? 'border-destructive focus-visible:ring-destructive' : undefined}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Button size="icon" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>备注 / Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="可选：交货期、包装、付款条件…" />
          <div className="flex justify-end">
            <Button onClick={() => submit.mutate()} disabled={submit.isPending || !validRows.length || invalidRows.length > 0}>
              {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              提交审批 / Submit for approval
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
