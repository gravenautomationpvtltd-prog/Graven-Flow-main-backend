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
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { useCreateOffice, useUpdateOffice } from "@/hooks/useOfficeManagement";
import type { Database } from "@/integrations/supabase/types";

type Office = Database['public']['Tables']['offices']['Row'];
type OfficeLocation = Database['public']['Enums']['office_location'];

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  location: z.enum(["delhi", "lucknow"] as const),
  address: z.string().optional(),
  phone: z.string().optional(),
  opening_time: z.string().optional(),
  closing_time: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  geofence_radius_meters: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const locationLabels: Record<OfficeLocation, string> = {
  delhi: "Delhi",
  lucknow: "Lucknow",
};

interface OfficeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  office?: Office | null;
}

export function OfficeDialog({ open, onOpenChange, mode, office }: OfficeDialogProps) {
  const createOffice = useCreateOffice();
  const updateOffice = useUpdateOffice();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "delhi",
      address: "",
      phone: "",
      opening_time: "09:00",
      closing_time: "18:00",
      latitude: "",
      longitude: "",
      geofence_radius_meters: "200",
    },
  });

  useEffect(() => {
    if (office && mode === "edit") {
      form.reset({
        name: office.name,
        location: office.location,
        address: office.address || "",
        phone: office.phone || "",
        opening_time: office.opening_time?.slice(0, 5) || "09:00",
        closing_time: office.closing_time?.slice(0, 5) || "18:00",
        latitude: (office as any).latitude?.toString() || "",
        longitude: (office as any).longitude?.toString() || "",
        geofence_radius_meters: (office as any).geofence_radius_meters?.toString() || "200",
      });
    } else if (mode === "create") {
      form.reset({
        name: "",
        location: "delhi",
        address: "",
        phone: "",
        opening_time: "09:00",
        closing_time: "18:00",
        latitude: "",
        longitude: "",
        geofence_radius_meters: "200",
      });
    }
  }, [office, mode, form]);

  const onSubmit = async (values: FormValues) => {
    const officeData = {
      name: values.name,
      location: values.location,
      address: values.address || null,
      phone: values.phone || null,
      opening_time: values.opening_time || null,
      closing_time: values.closing_time || null,
      latitude: values.latitude ? parseFloat(values.latitude) : null,
      longitude: values.longitude ? parseFloat(values.longitude) : null,
      geofence_radius_meters: values.geofence_radius_meters ? parseInt(values.geofence_radius_meters) : 200,
    };

    if (mode === "create") {
      await createOffice.mutateAsync(officeData as any);
    } else if (office) {
      await updateOffice.mutateAsync({
        id: office.id,
        ...officeData,
      } as any);
    }
    form.reset();
    onOpenChange(false);
  };

  const isPending = createOffice.isPending || updateOffice.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Office" : "Edit Office"}</DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Add a new office location to the system."
              : "Update the office details."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Office Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Delhi Head Office" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(locationLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Full office address..." 
                      className="resize-none"
                      {...field} 
                    />
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
                  <FormLabel>Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="+91 98765 43210" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="opening_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="closing_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Closing Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Geolocation Section */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Location-Based Attendance</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any"
                          placeholder="e.g., 28.6139" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any"
                          placeholder="e.g., 77.2090" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="geofence_radius_meters"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Geofence Radius (meters)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="200" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Employees within this radius will be marked as office attendance
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
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
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {mode === "create" ? "Create Office" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
