import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Trash2, UserPlus, CheckCircle, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline';
  onClick: () => void;
}

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

export function BulkActionBar({ selectedCount, onClearSelection, actions, className }: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
            'bg-background border border-border rounded-lg shadow-lg',
            'flex items-center gap-3 px-4 py-3',
            className
          )}
        >
          <div className="flex items-center gap-2 pr-3 border-r border-border">
            <span className="text-sm font-medium">{selectedCount} selected</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant || 'outline'}
                size="sm"
                onClick={action.onClick}
                className="gap-2"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Pre-configured action creators
export const createAssignAction = (onClick: () => void): BulkAction => ({
  id: 'assign',
  label: 'Assign',
  icon: <UserPlus className="h-4 w-4" />,
  onClick,
});

export const createStatusAction = (onClick: () => void): BulkAction => ({
  id: 'status',
  label: 'Update Status',
  icon: <CheckCircle className="h-4 w-4" />,
  onClick,
});

export const createDeleteAction = (onClick: () => void): BulkAction => ({
  id: 'delete',
  label: 'Delete',
  icon: <Trash2 className="h-4 w-4" />,
  variant: 'destructive',
  onClick,
});

export const createTagAction = (onClick: () => void): BulkAction => ({
  id: 'tag',
  label: 'Add Tag',
  icon: <Tag className="h-4 w-4" />,
  onClick,
});
