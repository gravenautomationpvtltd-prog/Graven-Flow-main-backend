import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { RFQItemSpecsPanel } from './RFQItemSpecsPanel';
import type { RFQItemFormData } from '@/hooks/useRFQItems';

interface Props {
  index: number;
  item: RFQItemFormData;
  onChange: (item: RFQItemFormData) => void;
  onRemove: () => void;
}

export function RFQItemRow({ index, item, onChange, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg">
      <div className="flex items-center gap-2 p-3">
        <span className="text-sm font-mono text-muted-foreground w-8">{index + 1}</span>
        <Input
          placeholder="Item description"
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
          className="flex-1 h-9"
        />
        <Input
          type="number"
          placeholder="Qty"
          value={item.quantity || ''}
          onChange={(e) => onChange({ ...item, quantity: Number(e.target.value) || 0 })}
          className="w-20 h-9"
        />
        <Input
          placeholder="Unit"
          value={item.unit}
          onChange={(e) => onChange({ ...item, unit: e.target.value })}
          className="w-20 h-9"
        />
        <Input
          type="number"
          placeholder="Target ₹"
          value={item.target_price ?? ''}
          onChange={(e) => onChange({ ...item, target_price: e.target.value ? Number(e.target.value) : null })}
          className="w-28 h-9"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} type="button">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <RFQItemSpecsPanel
            specs={item.specifications}
            onChange={(specs) => onChange({ ...item, specifications: specs })}
          />
        </div>
      )}
    </div>
  );
}
