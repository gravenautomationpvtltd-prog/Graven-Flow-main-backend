import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Upload, Download, Eye, Lock, Unlock, Folder, FileText, File } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { UploadDocumentDialog } from '@/components/supplier-network/UploadDocumentDialog';

type FolderType = 'company_documents' | 'certifications' | 'datasheets' | 'rfq_documents' | 'quotations' | 'contracts';

interface SupplierDocument {
  id: string;
  supplier_id: string;
  folder_type: FolderType;
  document_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  is_locked: boolean | null;
  version: number | null;
  created_at: string;
  suppliers?: { name: string } | null;
}

const FOLDER_LABELS: Record<FolderType, { label: string; icon: React.ReactNode }> = {
  company_documents: { label: 'Company Documents', icon: <Folder className="h-4 w-4" /> },
  certifications: { label: 'Certifications', icon: <FileText className="h-4 w-4" /> },
  datasheets: { label: 'Datasheets', icon: <File className="h-4 w-4" /> },
  rfq_documents: { label: 'RFQ Documents', icon: <FileText className="h-4 w-4" /> },
  quotations: { label: 'Quotations', icon: <FileText className="h-4 w-4" /> },
  contracts: { label: 'Contracts', icon: <FileText className="h-4 w-4" /> },
};

export default function SupplierDocuments() {
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['supplier-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_documents')
        .select(`
          *,
          suppliers(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SupplierDocument[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('application_status', 'approved')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const toggleLockMutation = useMutation({
    mutationFn: async ({ id, locked }: { id: string; locked: boolean }) => {
      const { error } = await supabase
        .from('supplier_documents')
        .update({ 
          is_locked: locked,
          locked_at: locked ? new Date().toISOString() : null,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-documents'] });
      toast.success('Document lock status updated');
    },
    onError: () => {
      toast.error('Failed to update document');
    },
  });

  const getFilteredDocuments = () => {
    let filtered = documents;
    
    if (folderFilter !== 'all') {
      filtered = filtered.filter(d => d.folder_type === folderFilter);
    }
    
    if (supplierFilter !== 'all') {
      filtered = filtered.filter(d => d.supplier_id === supplierFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.document_name?.toLowerCase().includes(query) ||
        d.suppliers?.name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadDocument = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const filteredDocuments = getFilteredDocuments();

  // Group documents by folder for stats
  const folderStats = Object.entries(FOLDER_LABELS).map(([key, value]) => ({
    folder: key as FolderType,
    label: value.label,
    count: documents.filter(d => d.folder_type === key).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Management</h1>
          <p className="text-muted-foreground">Manage supplier documents, certifications, and datasheets</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-6 gap-4">
        {folderStats.map((stat) => (
          <Card key={stat.folder} className="cursor-pointer hover:bg-muted/50" onClick={() => setFolderFilter(stat.folder)}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                {FOLDER_LABELS[stat.folder].icon}
                <div className="text-lg font-bold">{stat.count}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>All supplier documents organized by folder type</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={folderFilter} onValueChange={setFolderFilter}>
                <SelectTrigger className="w-[180px]">
                  <Folder className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Folders</SelectItem>
                  {Object.entries(FOLDER_LABELS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Folder</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading documents...
                    </TableCell>
                  </TableRow>
                ) : filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No documents found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.document_name}</TableCell>
                      <TableCell>{doc.suppliers?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {FOLDER_LABELS[doc.folder_type]?.label || doc.folder_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="uppercase text-xs">{doc.file_type || '-'}</TableCell>
                      <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                      <TableCell>v{doc.version || 1}</TableCell>
                      <TableCell>{format(new Date(doc.created_at), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        {doc.is_locked ? (
                          <Badge variant="secondary">
                            <Lock className="mr-1 h-3 w-3" />
                            Locked
                          </Badge>
                        ) : (
                          <Badge variant="outline">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(doc.file_url, '_blank')}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadDocument(doc.file_url, doc.document_name)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {doc.is_locked ? (
                              <DropdownMenuItem onClick={() => toggleLockMutation.mutate({ id: doc.id, locked: false })}>
                                <Unlock className="mr-2 h-4 w-4" />
                                Unlock
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => toggleLockMutation.mutate({ id: doc.id, locked: true })}>
                                <Lock className="mr-2 h-4 w-4" />
                                Lock
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UploadDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        suppliers={suppliers}
      />
    </div>
  );
}
