import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountsOverview } from "@/components/accounts/AccountsOverview";
import { ReceivablesTable } from "@/components/accounts/ReceivablesTable";
import { PayablesTable } from "@/components/accounts/PayablesTable";
import { PaymentsHistory } from "@/components/accounts/PaymentsHistory";
import { GSTSummary } from "@/components/accounts/GSTSummary";
import { FinanceOrdersTab } from "@/components/accounts/FinanceOrdersTab";
import { AccountsCustomersTab } from "@/components/accounts/AccountsCustomersTab";
import { GstFilingTab } from "@/components/accounts/GstFilingTab";
import { BooksTab } from "@/components/accounts/BooksTab";
import { PurchaseBillsTab } from "@/components/accounts/PurchaseBillsTab";
import { ExpensesAssetsTab } from "@/components/accounts/ExpensesAssetsTab";
import { DateRangeFilter, type DatePreset, getDateRangeFromPreset } from "@/components/ui/date-range-filter";

const Accounts = () => {
  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const dateRange = getDateRangeFromPreset(datePreset, customFrom, customTo);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            Manage receivables, payables, and financial summaries
          </p>
        </div>
        <DateRangeFilter
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="payables">Payables</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="purchase-bills">Purchase Bills</TabsTrigger>
          <TabsTrigger value="expenses">Expenses &amp; Assets</TabsTrigger>
          <TabsTrigger value="filing">GST Filing</TabsTrigger>
          <TabsTrigger value="books">Books</TabsTrigger>
          <TabsTrigger value="gst">GST Summary</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="purchase-bills">
          <PurchaseBillsTab />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpensesAssetsTab />
        </TabsContent>

        <TabsContent value="filing">
          <GstFilingTab />
        </TabsContent>

        <TabsContent value="books">
          <BooksTab />
        </TabsContent>

        <TabsContent value="orders">
          <FinanceOrdersTab />
        </TabsContent>

        <TabsContent value="overview">
          <AccountsOverview />
        </TabsContent>

        <TabsContent value="receivables">
          <ReceivablesTable />
        </TabsContent>

        <TabsContent value="payables">
          <PayablesTable />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsHistory />
        </TabsContent>

        <TabsContent value="gst">
          <GSTSummary />
        </TabsContent>

        <TabsContent value="customers">
          <AccountsCustomersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Accounts;
