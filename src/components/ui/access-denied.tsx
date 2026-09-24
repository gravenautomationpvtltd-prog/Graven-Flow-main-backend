import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

interface AccessDeniedProps {
  title?: string;
  message?: string;
}

export function AccessDenied({ 
  title = "Access Denied",
  message = "You don't have permission to access this section."
}: AccessDeniedProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive/50" />
        <h3 className="mt-4 text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
