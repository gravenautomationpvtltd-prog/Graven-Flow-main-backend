import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CustomFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  entity: 'lead' | 'customer' | 'product';
}

interface Props {
  entity: 'lead' | 'customer' | 'product';
  industryCode?: string;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

export function IndustryCustomFields({ entity, industryCode, values, onChange }: Props) {
  const { data: industry } = useQuery({
    queryKey: ['industry-config', industryCode],
    queryFn: async () => {
      if (!industryCode) return null;
      const { data, error } = await supabase
        .from('industries')
        .select('custom_fields')
        .eq('code', industryCode)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!industryCode,
  });

  if (!industry?.custom_fields) return null;

  const customFields = (industry.custom_fields as unknown as CustomFieldConfig[])
    .filter((f) => f.entity === entity);

  if (customFields.length === 0) return null;

  const set = (key: string, value: any) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="border-t border-border pt-4 mt-4">
      <h4 className="text-sm font-semibold text-muted-foreground mb-3">Industry-Specific Fields</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {customFields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label>{field.label}</Label>
            {field.type === 'select' && field.options ? (
              <Select
                value={values[field.key] || ''}
                onValueChange={(v) => set(field.key, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${field.label}`} />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={field.type === 'number' ? 'number' : 'text'}
                value={values[field.key] || ''}
                onChange={(e) => set(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
