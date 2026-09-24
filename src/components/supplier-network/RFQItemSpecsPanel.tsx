import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RFQItemSpec } from '@/hooks/useRFQItems';

interface Props {
  specs: RFQItemSpec;
  onChange: (specs: RFQItemSpec) => void;
}

const SPEC_FIELDS: { key: keyof RFQItemSpec; label: string; placeholder: string }[] = [
  { key: 'brand', label: 'Brand', placeholder: 'e.g. Siemens' },
  { key: 'model_number', label: 'Model Number', placeholder: 'e.g. 6ES7...' },
  { key: 'voltage', label: 'Voltage', placeholder: 'e.g. 24V DC' },
  { key: 'current', label: 'Current', placeholder: 'e.g. 2A' },
  { key: 'kw_rating', label: 'kW Rating', placeholder: 'e.g. 1.5' },
  { key: 'protocol', label: 'Protocol', placeholder: 'e.g. Profinet' },
  { key: 'ip_rating', label: 'IP Rating', placeholder: 'e.g. IP67' },
  { key: 'mounting_type', label: 'Mounting Type', placeholder: 'e.g. DIN Rail' },
  { key: 'compliance_standards', label: 'Compliance Standards', placeholder: 'e.g. CE, UL' },
];

export function RFQItemSpecsPanel({ specs, onChange }: Props) {
  const update = (key: keyof RFQItemSpec, value: string) => {
    onChange({ ...specs, [key]: value });
  };

  return (
    <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Technical Specifications</p>
      <div className="grid grid-cols-3 gap-3">
        {SPEC_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <Label className="text-xs">{label}</Label>
            <Input
              value={specs[key] || ''}
              onChange={(e) => update(key, e.target.value)}
              placeholder={placeholder}
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>
      <div>
        <Label className="text-xs">Remarks</Label>
        <Textarea
          value={specs.remarks || ''}
          onChange={(e) => update('remarks', e.target.value)}
          placeholder="Additional notes..."
          className="min-h-[50px] text-xs"
        />
      </div>
    </div>
  );
}
