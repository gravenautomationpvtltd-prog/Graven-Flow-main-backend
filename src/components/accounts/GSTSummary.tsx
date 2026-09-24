import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGSTSummary } from "@/hooks/useAccounts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, TrendingUp, TrendingDown, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export function GSTSummary() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data: gst, isLoading } = useGSTSummary(
    date?.from ? format(date.from, 'yyyy-MM-dd') : undefined,
    date?.to ? format(date.to, 'yyyy-MM-dd') : undefined
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const outputGST = (gst?.outputCGST || 0) + (gst?.outputSGST || 0) + (gst?.outputIGST || 0);
  const inputGST = (gst?.inputCGST || 0) + (gst?.inputSGST || 0) + (gst?.inputIGST || 0);
  const netGST = outputGST - inputGST;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[300px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Output GST (Sales)
            </CardTitle>
            <div className="p-2 rounded-lg bg-green-100">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{outputGST.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">GST collected on sales</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">CGST:</span>
                <span>₹{(gst?.outputCGST || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SGST:</span>
                <span>₹{(gst?.outputSGST || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IGST:</span>
                <span>₹{(gst?.outputIGST || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Input GST (Purchases)
            </CardTitle>
            <div className="p-2 rounded-lg bg-red-100">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{inputGST.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">GST paid on purchases</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">CGST:</span>
                <span>₹{(gst?.inputCGST || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SGST:</span>
                <span>₹{(gst?.inputSGST || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IGST:</span>
                <span>₹{(gst?.inputIGST || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net GST Liability
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-100">
              <Calculator className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              netGST >= 0 ? "text-red-600" : "text-green-600"
            )}>
              {netGST >= 0 ? '' : '-'}₹{Math.abs(netGST).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {netGST >= 0 ? 'Payable to government' : 'Credit available'}
            </p>
            <div className="mt-2 pt-2 border-t text-sm">
              <div className="flex justify-between font-medium">
                <span>{netGST >= 0 ? 'Amount Due:' : 'Refund/Carry Forward:'}</span>
                <span className={netGST >= 0 ? 'text-red-600' : 'text-green-600'}>
                  ₹{Math.abs(netGST).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
