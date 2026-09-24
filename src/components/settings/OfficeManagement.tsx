import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Building, 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2,
  MapPin,
  Phone,
  Clock
} from "lucide-react";
import { useOfficesManagement, useDeleteOffice } from "@/hooks/useOfficeManagement";
import { useAuth } from "@/hooks/useAuth";
import { OfficeDialog } from "./OfficeDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessDenied } from "@/components/ui/access-denied";
import type { Database } from "@/integrations/supabase/types";

type Office = Database['public']['Tables']['offices']['Row'];
type OfficeLocation = Database['public']['Enums']['office_location'];

const locationLabels: Record<OfficeLocation, string> = {
  delhi: "Delhi",
  lucknow: "Lucknow",
};

const locationColors: Record<OfficeLocation, string> = {
  delhi: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  lucknow: "bg-green-500/10 text-green-600 border-green-500/20",
};

function formatTime(time: string | null): string {
  if (!time) return "—";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function OfficeManagement() {
  const { isAdmin } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editOffice, setEditOffice] = useState<Office | null>(null);
  const [deleteOffice, setDeleteOffice] = useState<Office | null>(null);

  const { data: offices, isLoading } = useOfficesManagement();
  const deleteOfficeMutation = useDeleteOffice();

  const handleDelete = async () => {
    if (!deleteOffice) return;
    await deleteOfficeMutation.mutateAsync(deleteOffice.id);
    setDeleteOffice(null);
  };

  if (!isAdmin) {
    return (
      <AccessDenied 
        title="Admin Access Required"
        message="Only administrators can manage office locations."
      />
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Office Management</CardTitle>
                <CardDescription>Manage Delhi and Lucknow office locations</CardDescription>
              </div>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Office
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {offices?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p>No offices configured yet</p>
              <p className="text-sm">Add your first office to get started</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Office Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Working Hours</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offices?.map((office) => (
                    <TableRow key={office.id}>
                      <TableCell>
                        <p className="font-medium">{office.name}</p>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={locationColors[office.location]}
                        >
                          {locationLabels[office.location]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {office.address ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[200px]">{office.address}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {office.phone ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{office.phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {formatTime(office.opening_time)} - {formatTime(office.closing_time)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditOffice(office)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeleteOffice(office)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <OfficeDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        mode="create"
      />

      <OfficeDialog 
        open={!!editOffice} 
        onOpenChange={(open) => !open && setEditOffice(null)}
        mode="edit"
        office={editOffice}
      />

      <AlertDialog open={!!deleteOffice} onOpenChange={(open) => !open && setDeleteOffice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Office</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteOffice?.name}"? This action cannot be undone.
              Users and leads assigned to this office will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
