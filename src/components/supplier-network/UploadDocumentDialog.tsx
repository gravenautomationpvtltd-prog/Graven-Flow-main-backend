import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; suppliers: { id: string; name: string }[]; }

const FOLDER_TYPES = ['company_documents', 'certifications', 'datasheets', 'rfq_documents', 'quotations', 'contracts'];

export function UploadDocumentDialog({ open, onOpenChange, suppliers }: Props) {
  const [supplierId, setSupplierId] = useState('');
  const [folderType, setFolderType] = useState('company_documents');
  const [file, setFile] = useState<File | null>(null);
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !supplierId) throw new Error('Missing data');
      const path = `supplier-docs/${supplierId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      const { error } = await supabase.from('supplier_documents').insert({ supplier_id: supplierId, folder_type: folderType, document_name: file.name, file_url: publicUrl, file_size: file.size, file_type: file.type.split('/')[1], uploaded_by: profile?.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplier-documents'] }); onOpenChange(false); toast.success('Document uploaded'); setFile(null); },
    onError: () => toast.error('Upload failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Supplier</Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Folder</Label><Select value={folderType} onValueChange={setFolderType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FOLDER_TYPES.map(f => <SelectItem key={f} value={f}>{f.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>File</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <Button onClick={() => uploadMutation.mutate()} className="w-full" disabled={!file || !supplierId}>Upload</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
