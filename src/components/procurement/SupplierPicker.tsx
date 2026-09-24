import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SupplierPickerValue {
  supplierId: string | null;
  supplierName: string;
}

interface PickerSupplier {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  status: string | null;
}

function useSupplierOptions() {
  return useQuery({
    queryKey: ['supplier-picker-options'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PickerSupplier[]> => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, city, category, status')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as PickerSupplier[];
    },
  });
}

/**
 * Searchable supplier combobox with inline "create new supplier".
 * Stores supplier_id (for tracking / analytics) alongside the name snapshot.
 */
export function SupplierPicker({
  value,
  onChange,
  className,
  placeholder = 'Search suppliers…',
}: {
  value: SupplierPickerValue;
  onChange: (v: SupplierPickerValue) => void;
  className?: string;
  placeholder?: string;
}) {
  const { data: suppliers = [], isLoading } = useSupplierOptions();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newDetails, setNewDetails] = useState({ city: '', contact: '', phone: '' });
  const [showDetails, setShowDetails] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? suppliers.filter((s) =>
          [s.name, s.city, s.category].filter(Boolean).join(' ').toLowerCase().includes(q)
        )
      : suppliers;
    return list.slice(0, 60);
  }, [suppliers, search]);

  const exactExists = suppliers.some(
    (s) => s.name.trim().toLowerCase() === search.trim().toLowerCase()
  );

  const resetCreate = () => {
    setNewDetails({ city: '', contact: '', phone: '' });
    setShowDetails(false);
    setSearch('');
  };

  const createSupplier = async () => {
    const name = search.trim();
    if (!name) return;
    setCreating(true);
    try {
      // Never create a duplicate: reuse any existing record with the same name,
      // including inactive ones that are hidden from the picker list.
      const { data: existing } = await supabase
        .from('suppliers')
        .select('id, name')
        .ilike('name', name)
        .limit(1)
        .maybeSingle();

      if (existing) {
        onChange({ supplierId: existing.id, supplierName: existing.name });
        toast.success(`Linked to existing supplier ${existing.name}`);
        setOpen(false);
        resetCreate();
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name,
          status: 'pending',
          is_active: true,
          registration_source: 'manual',
          city: newDetails.city.trim() || null,
          contact_person: newDetails.contact.trim() || null,
          phone: newDetails.phone.trim() || null,
          created_by: user?.id ?? null,
        } as any)
        .select('id, name')
        .single();
      if (error) throw error;
      onChange({ supplierId: data.id, supplierName: data.name });
      qc.invalidateQueries({ queryKey: ['supplier-picker-options'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['pending-suppliers'] });
      toast.success(`${data.name} added — complete onboarding later`);
      setOpen(false);
      resetCreate();
    } catch (e: any) {
      toast.error('Could not add supplier: ' + e.message);
    } finally {
      setCreating(false);
    }
  };


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !value.supplierName && 'text-muted-foreground')}>
            {value.supplierName || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type a new name…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <CommandEmpty>Loading suppliers…</CommandEmpty>
            ) : filtered.length === 0 && !search.trim() ? (
              <CommandEmpty>No suppliers on record yet.</CommandEmpty>
            ) : null}

            {filtered.length > 0 && (
              <CommandGroup heading="Suppliers on record">
                {filtered.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => {
                      onChange({ supplierId: s.id, supplierName: s.name });
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.supplierId === s.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[s.city, s.category, s.status].filter(Boolean).join(' · ') ||
                          'No details'}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {search.trim() && !exactExists && (
              <CommandGroup heading="Not on record">
                <CommandItem
                  value={`__create__${search}`}
                  disabled={creating}
                  onSelect={createSupplier}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {creating ? 'Adding…' : `Add “${search.trim()}” as a new supplier`}
                </CommandItem>
                <div className="px-2 pb-2 space-y-2">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() => setShowDetails((v) => !v)}
                  >
                    {showDetails ? 'Hide extra details' : 'Add city / contact (optional)'}
                  </button>
                  {showDetails && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        className="h-8 text-xs"
                        placeholder="City"
                        value={newDetails.city}
                        onChange={(e) =>
                          setNewDetails((d) => ({ ...d, city: e.target.value }))
                        }
                      />
                      <Input
                        className="h-8 text-xs"
                        placeholder="Contact"
                        value={newDetails.contact}
                        onChange={(e) =>
                          setNewDetails((d) => ({ ...d, contact: e.target.value }))
                        }
                      />
                      <Input
                        className="h-8 text-xs"
                        placeholder="Phone"
                        value={newDetails.phone}
                        onChange={(e) =>
                          setNewDetails((d) => ({ ...d, phone: e.target.value }))
                        }
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    New suppliers are saved as “pending” so onboarding can be completed later —
                    their quotes still count in supplier analytics.
                  </p>
                </div>
                <CommandItem
                  value={`__freetext__${search}`}
                  onSelect={() => {
                    onChange({ supplierId: null, supplierName: search.trim() });
                    setOpen(false);
                    resetCreate();
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="min-w-0">
                    <span className="block truncate">
                      Use “{search.trim()}” without linking
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Name only — excluded from supplier reports
                    </span>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}


            {value.supplierName && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange({ supplierId: null, supplierName: '' });
                    setOpen(false);
                  }}
                >
                  Clear selection
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
