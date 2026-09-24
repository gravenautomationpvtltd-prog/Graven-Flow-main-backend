import { User, Phone, Mail, ExternalLink, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Database } from '@/integrations/supabase/types';
import { Link } from 'react-router-dom';

type Customer = Database['public']['Tables']['customers']['Row'];

interface LeadCustomerInfoProps {
  customer: Customer | null | undefined;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function LeadCustomerInfo({ customer }: LeadCustomerInfoProps) {
  if (!customer) {
    return (
      <Card className="shadow-sm border-border/50 rounded-xl overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30">
          <CardTitle className="text-sm font-semibold">Customer Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <User className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No customer linked</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const location = [customer.city, customer.state].filter(Boolean).join(', ');

  return (
    <Card className="shadow-sm border-border/50 rounded-xl overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <CardTitle className="text-sm font-semibold">Customer Details</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Company Info Row */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {getInitials(customer.company_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{customer.company_name}</p>
            {location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </p>
            )}
          </div>
        </div>

        {/* Contact Details */}
        <div className="space-y-2.5">
          {customer.phone && (
            <a 
              href={`tel:${customer.phone}`}
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mobile</p>
                <p>{customer.phone}</p>
              </div>
            </a>
          )}
          {customer.email && (
            <a 
              href={`mailto:${customer.email}`}
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="truncate">{customer.email}</p>
              </div>
            </a>
          )}
        </div>

        {/* Assigned Salesperson */}
        {(customer as any).assigned_sales?.full_name && (
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Assigned To</p>
              <p>{(customer as any).assigned_sales.full_name}</p>
            </div>
          </div>
        )}

        {/* View Profile Button */}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to={`/customers/${customer.id}`}>
            View Full Profile
            <ExternalLink className="h-3.5 w-3.5 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
