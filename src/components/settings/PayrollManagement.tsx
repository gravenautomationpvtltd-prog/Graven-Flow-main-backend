import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PayrollRunsTable } from './PayrollRunsTable';
import { EmployeeSalariesTable } from './EmployeeSalariesTable';
import { PayrollSlabsTable } from './PayrollSlabsTable';
import { GeneratePayrollDialog } from './GeneratePayrollDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/access-denied';

export function PayrollManagement() {
  const { isAdmin, isHR } = useAuth();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  if (!isAdmin && !isHR) {
    return (
      <AccessDenied 
        title="HR/Admin Access Required"
        message="Only HR and administrators can manage payroll."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payroll Management</h2>
          <p className="text-muted-foreground">
            Generate payroll with automatic attendance-based deductions and bonuses
          </p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate Payroll
        </Button>
      </div>

      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">Payroll Runs</TabsTrigger>
          <TabsTrigger value="salaries">Employee Salaries</TabsTrigger>
          <TabsTrigger value="slabs">Deduction Slabs</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle>Payroll History</CardTitle>
              <CardDescription>
                View and manage monthly payroll runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayrollRunsTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salaries">
          <Card>
            <CardHeader>
              <CardTitle>Employee Salaries</CardTitle>
              <CardDescription>
                Configure base salaries for employees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmployeeSalariesTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slabs">
          <Card>
            <CardHeader>
              <CardTitle>Late Deduction Slabs</CardTitle>
              <CardDescription>
                Configure slab-based deductions for late arrivals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayrollSlabsTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <GeneratePayrollDialog 
        open={showGenerateDialog} 
        onOpenChange={setShowGenerateDialog} 
      />
    </div>
  );
}
