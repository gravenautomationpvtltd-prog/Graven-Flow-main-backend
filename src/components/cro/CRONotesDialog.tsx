import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useUpdateCROAssignment, type CROAssignment } from '@/hooks/useCROAssignments';

interface CRONotesDialogProps {
  assignment: CROAssignment | null;
  onClose: () => void;
}

export default function CRONotesDialog({ assignment, onClose }: CRONotesDialogProps) {
  const [noteText, setNoteText] = useState('');
  const updateAssignment = useUpdateCROAssignment();

  useEffect(() => {
    if (assignment) {
      setNoteText(assignment.notes || '');
    }
  }, [assignment]);

  const handleSave = () => {
    if (!assignment) return;
    updateAssignment.mutate({
      id: assignment.id,
      notes: noteText,
    });
    onClose();
  };

  return (
    <Dialog open={!!assignment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notes for {assignment?.customer.company_name}</DialogTitle>
          <DialogDescription>Add or update follow-up notes</DialogDescription>
        </DialogHeader>
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add your notes here..."
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateAssignment.isPending}>
            {updateAssignment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
