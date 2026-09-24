import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Mail, 
  MessageSquare, 
  Play, 
  Users, 
  BarChart3, 
  Settings2, 
  Edit2, 
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  useOutreachTemplates, 
  useUpdateOutreachTemplate, 
  useCustomerOutreachHistory, 
  useOutreachStats,
  useTriggerOutreach,
} from '@/hooks/useCustomerOutreach';
import { useActiveWhatsAppTemplates } from '@/hooks/useWhatsAppTemplates';
import { WhatsAppTemplatesManagement } from './WhatsAppTemplatesManagement';
import { AccessDenied } from '@/components/ui/access-denied';
import { useAuth } from '@/hooks/useAuth';

export function CustomerOutreachManagement() {
  const { isAdmin } = useAuth();
  const { data: templates, isLoading: templatesLoading } = useOutreachTemplates();
  const { data: history, isLoading: historyLoading } = useCustomerOutreachHistory();
  const { data: stats, isLoading: statsLoading } = useOutreachStats();
  const { data: whatsappTemplates } = useActiveWhatsAppTemplates();
  const updateTemplate = useUpdateOutreachTemplate();
  const triggerOutreach = useTriggerOutreach();

  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [outreachConfig, setOutreachConfig] = useState({
    batchSize: 50,
    daysGap: 30,
    channels: ['email', 'whatsapp'] as ('email' | 'whatsapp')[],
    whatsappCampaignName: '',
  });

  if (!isAdmin) {
    return <AccessDenied />;
  }

  const emailTemplate = templates?.find(t => t.channel === 'email');
  const whatsappTemplate = templates?.find(t => t.channel === 'whatsapp');

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    
    await updateTemplate.mutateAsync({
      id: editingTemplate.id,
      name: editingTemplate.name,
      subject: editingTemplate.subject,
      body: editingTemplate.body,
      whatsapp_template_name: editingTemplate.whatsapp_template_name,
      is_active: editingTemplate.is_active,
    });
    setEditingTemplate(null);
  };

  const handleTriggerOutreach = async () => {
    await triggerOutreach.mutateAsync({
      ...outreachConfig,
      whatsappCampaignName: outreachConfig.whatsappCampaignName || undefined,
    });
  };

  // Set default WhatsApp template when loaded
  const defaultWhatsAppTemplate = whatsappTemplates?.find(t => t.is_default);
  useEffect(() => {
    if (defaultWhatsAppTemplate && !outreachConfig.whatsappCampaignName) {
      setOutreachConfig(prev => ({ ...prev, whatsappCampaignName: defaultWhatsAppTemplate.campaign_name }));
    }
  }, [defaultWhatsAppTemplate?.campaign_name]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="secondary"><Send className="h-3 w-3 mr-1" /> Sent</Badge>;
      case 'responded':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Responded</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats?.totalCustomers?.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats?.customersWithEmail?.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground">With Email</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats?.customersWithSalesperson?.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground">Assigned Sales</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold">{stats?.recentOutreachCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">Sent (30 days)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold">{stats?.responsesCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">Responses</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-2xl font-bold">{stats?.leadsGenerated}</span>
                </div>
                <p className="text-xs text-muted-foreground">Leads Created</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="run" className="space-y-4">
        <TabsList>
          <TabsTrigger value="run" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Run Outreach
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Run Outreach Tab */}
        <TabsContent value="run">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Run Customer Outreach
              </CardTitle>
              <CardDescription>
                Send enquiry request messages to customers who haven't been contacted recently.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Batch Size</Label>
                  <Input
                    type="number"
                    value={outreachConfig.batchSize}
                    onChange={(e) => setOutreachConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 50 }))}
                    min={1}
                    max={200}
                  />
                  <p className="text-xs text-muted-foreground">Number of customers per batch</p>
                </div>
                <div className="space-y-2">
                  <Label>Days Gap</Label>
                  <Input
                    type="number"
                    value={outreachConfig.daysGap}
                    onChange={(e) => setOutreachConfig(prev => ({ ...prev, daysGap: parseInt(e.target.value) || 30 }))}
                    min={7}
                    max={180}
                  />
                  <p className="text-xs text-muted-foreground">Don't contact customers reached within X days</p>
                </div>
                <div className="space-y-2">
                  <Label>Channels</Label>
                  <Select
                    value={outreachConfig.channels.join(',')}
                    onValueChange={(value) => setOutreachConfig(prev => ({ ...prev, channels: value.split(',') as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email,whatsapp">Email & WhatsApp</SelectItem>
                      <SelectItem value="email">Email Only</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* WhatsApp Template Selection */}
              {outreachConfig.channels.includes('whatsapp') && (
                <div className="space-y-2">
                  <Label>WhatsApp Template</Label>
                  <Select
                    value={outreachConfig.whatsappCampaignName}
                    onValueChange={(value) => setOutreachConfig(prev => ({ ...prev, whatsappCampaignName: value }))}
                  >
                    <SelectTrigger className="w-full md:w-[400px]">
                      <SelectValue placeholder="Select WhatsApp template" />
                    </SelectTrigger>
                    <SelectContent>
                      {whatsappTemplates?.map((template) => (
                        <SelectItem key={template.id} value={template.campaign_name}>
                          <div className="flex items-center gap-2">
                            <span>{template.name}</span>
                            {template.is_default && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the AiSensy campaign template to use for WhatsApp messages
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4">
                <Button
                  onClick={handleTriggerOutreach}
                  disabled={triggerOutreach.isPending}
                  className="flex items-center gap-2"
                >
                  {triggerOutreach.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Start Outreach
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  This will send messages to customers with assigned salespeople who haven't been contacted in {outreachConfig.daysGap} days.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="space-y-6">
            {/* WhatsApp Templates Management */}
            <WhatsAppTemplatesManagement />

            <div className="grid gap-4 md:grid-cols-2">
            {/* Email Template */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Template
                  </CardTitle>
                  {emailTemplate && (
                    <div className="flex items-center gap-2">
                      <Badge variant={emailTemplate.is_active ? 'default' : 'secondary'}>
                        {emailTemplate.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => setEditingTemplate(emailTemplate)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Email Template</DialogTitle>
                          </DialogHeader>
                          {editingTemplate?.channel === 'email' && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input
                                  value={editingTemplate.name}
                                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Subject</Label>
                                <Input
                                  value={editingTemplate.subject || ''}
                                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Body</Label>
                                <Textarea
                                  value={editingTemplate.body}
                                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                                  rows={10}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Use {'{{customer_name}}'} and {'{{salesperson_name}}'} for personalization
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={editingTemplate.is_active}
                                  onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, is_active: checked })}
                                />
                                <Label>Active</Label>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveTemplate} disabled={updateTemplate.isPending}>
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <Skeleton className="h-40" />
                ) : emailTemplate ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Subject: {emailTemplate.subject}</p>
                    <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {emailTemplate.body}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No email template configured</p>
                )}
              </CardContent>
            </Card>

            {/* WhatsApp Template */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    WhatsApp Template
                  </CardTitle>
                  {whatsappTemplate && (
                    <div className="flex items-center gap-2">
                      <Badge variant={whatsappTemplate.is_active ? 'default' : 'secondary'}>
                        {whatsappTemplate.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => setEditingTemplate(whatsappTemplate)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit WhatsApp Template</DialogTitle>
                          </DialogHeader>
                          {editingTemplate?.channel === 'whatsapp' && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input
                                  value={editingTemplate.name}
                                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>WhatsApp Template Name (Approved)</Label>
                                <Input
                                  value={editingTemplate.whatsapp_template_name || ''}
                                  onChange={(e) => setEditingTemplate({ ...editingTemplate, whatsapp_template_name: e.target.value })}
                                  placeholder="e.g., enquiry_request"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Must be an approved template in your WhatsApp Business account
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label>Message Body (Preview)</Label>
                                <Textarea
                                  value={editingTemplate.body}
                                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                                  rows={6}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={editingTemplate.is_active}
                                  onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, is_active: checked })}
                                />
                                <Label>Active</Label>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveTemplate} disabled={updateTemplate.isPending}>
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <Skeleton className="h-40" />
                ) : whatsappTemplate ? (
                  <div className="space-y-2">
                    {whatsappTemplate.whatsapp_template_name && (
                      <p className="text-sm font-medium">Template: {whatsappTemplate.whatsapp_template_name}</p>
                    )}
                    <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {whatsappTemplate.body}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No WhatsApp template configured</p>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Outreach History</CardTitle>
              <CardDescription>Recent customer outreach campaigns and responses</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : !history?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  No outreach history yet. Run your first campaign above.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.customer?.company_name}</p>
                            <p className="text-sm text-muted-foreground">{item.customer?.contact_person}</p>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(item.campaign_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {item.email_sent_at ? (
                            <Badge variant="outline" className="text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              {format(new Date(item.email_sent_at), 'HH:mm')}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.whatsapp_sent_at ? (
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {format(new Date(item.whatsapp_sent_at), 'HH:mm')}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          {item.email_response_at && (
                            <Badge className="bg-blue-500/10 text-blue-500 text-xs mr-1">
                              Email: {format(new Date(item.email_response_at), 'dd MMM')}
                            </Badge>
                          )}
                          {item.whatsapp_response_at && (
                            <Badge className="bg-green-500/10 text-green-500 text-xs">
                              WA: {format(new Date(item.whatsapp_response_at), 'dd MMM')}
                            </Badge>
                          )}
                          {!item.email_response_at && !item.whatsapp_response_at && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
