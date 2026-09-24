import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useOffices, useUpdateUserProfile, useUserSalary, useUpdateUserSalary, useUsersWithRoles, useUpdateUserEmail, useSetProtectedOwner, useSetPriceComparisonAccess } from "@/hooks/useUserManagement";
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldCheck } from "lucide-react";

const formSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  office_id: z.string().optional(),
  manager_id: z.string().optional(),
  base_salary: z.coerce.number().min(0, "Salary cannot be negative").optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string;
    email: string;
    phone?: string | null;
    office_id?: string | null;
    manager_id?: string | null;
    is_protected_owner?: boolean | null;
  } | null;
}

export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
  const { data: offices } = useOffices();
  const { data: allUsers } = useUsersWithRoles();
  const { data: salary, isLoading: salaryLoading } = useUserSalary(user?.id);
  const updateProfile = useUpdateUserProfile();
  const updateSalary = useUpdateUserSalary();
  const updateEmail = useUpdateUserEmail();
  const setProtectedOwner = useSetProtectedOwner();
  const setComparisonAccess = useSetPriceComparisonAccess();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      office_id: "",
      manager_id: "",
      base_salary: 0,
    },
  });

  // Reset form when user changes
  useEffect(() => {
    if (user && open) {
      form.reset({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        office_id: user.office_id || "",
        manager_id: user.manager_id || "",
        base_salary: salary?.base_salary || 0,
      });
    }
  }, [user, open, salary, form]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    try {
      // Update email if changed (case-insensitive comparison)
      const isEmailChanged = values.email.trim().toLowerCase() !== (user.email || '').trim().toLowerCase();
      if (isEmailChanged) {
        try {
          await updateEmail.mutateAsync({
            userId: user.id,
            newEmail: values.email,
          });
        } catch (emailError) {
          console.warn('Email update failed, continuing with other updates:', emailError);
        }
      }

      // Update profile
      await updateProfile.mutateAsync({
        userId: user.id,
        full_name: values.full_name,
        phone: values.phone || null,
        office_id: values.office_id || null,
        manager_id: values.manager_id || null,
      });

      // Update salary if provided
      if (values.base_salary !== undefined && values.base_salary > 0) {
        await updateSalary.mutateAsync({
          userId: user.id,
          base_salary: values.base_salary,
        });
      }

      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const isPending = updateProfile.isPending || updateSalary.isPending || updateEmail.isPending;

  // Filter out current user from manager options
  const managerOptions = allUsers?.filter(u => u.id !== user?.id) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User Details</DialogTitle>
          <DialogDescription>
            Update user profile information and salary details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="user@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+91 9876543210" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="office_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Office / Branch</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} value={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select office" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">No office assigned</SelectItem>
                      {offices?.map((office) => (
                        <SelectItem key={office.id} value={office.id}>
                          {office.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="manager_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reporting Manager</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} value={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">No manager assigned</SelectItem>
                      {managerOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="base_salary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Salary (₹)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        className="pl-7" 
                        {...field}
                        value={salaryLoading ? "" : field.value}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Protected owner
                </div>
                <p className="text-xs text-muted-foreground">
                  Their customers are locked to them and cannot be reassigned by
                  redistribution, bulk reassign, or ownership-mismatch tools.
                </p>
              </div>
              <Switch
                checked={!!user?.is_protected_owner}
                disabled={!user || setProtectedOwner.isPending}
                onCheckedChange={(checked) => {
                  if (!user) return;
                  setProtectedOwner.mutate({ userId: user.id, isProtected: checked });
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Price comparison sheet access
                </div>
                <p className="text-xs text-muted-foreground">
                  Allows downloading the internal comparison sheet (RMB cost, landed INR,
                  list price and margins) from quotations. Keep off for most users.
                </p>
              </div>
              <Switch
                checked={!!(user as any)?.can_view_price_comparison}
                disabled={!user || setComparisonAccess.isPending}
                onCheckedChange={(checked) => {
                  if (!user) return;
                  setComparisonAccess.mutate({ userId: user.id, allowed: checked });
                }}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
