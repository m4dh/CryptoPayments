import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, Plus, Key, Trash2, ArrowLeft, RefreshCw, Eye, EyeOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

interface Tenant {
  id: string;
  name: string;
  apiKey: string;
  webhookUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CreateTenantResponse {
  tenant: Tenant;
  apiKey: string;
  webhookSecret: string;
  message: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const { data: tenantsData, isLoading } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ['/api/tenants'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; webhookUrl?: string }) => {
      const response = await apiRequest('POST', '/api/tenants', data);
      return response.json() as Promise<CreateTenantResponse>;
    },
    onSuccess: (data) => {
      setNewApiKey(data.apiKey);
      setNewWebhookSecret(data.webhookSecret);
      setName("");
      setWebhookUrl("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      toast({
        title: "API Key Created",
        description: "Save your API key - it will not be shown again!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const toggleKeyVisibility = (id: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleKeys(newVisible);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      webhookUrl: webhookUrl.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Key className="h-6 w-6" />
                  API Key Management
                </h1>
                <p className="text-muted-foreground">Create and manage API keys for your applications</p>
              </div>
            </div>
            <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-key">
              <Plus className="h-4 w-4 mr-2" />
              New API Key
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {newApiKey && (
          <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <AlertDescription>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold">
                  <Check className="h-5 w-5" />
                  API Key Created Successfully!
                </div>
                <p className="text-sm text-muted-foreground">
                  Save these credentials securely - they will not be shown again.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">API Key</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        value={newApiKey} 
                        readOnly 
                        className="font-mono text-sm bg-white dark:bg-gray-900"
                        data-testid="input-new-api-key"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(newApiKey, "API Key")}
                        data-testid="button-copy-api-key"
                      >
                        {copied === "API Key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs">Webhook Secret</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        value={newWebhookSecret || ""} 
                        readOnly 
                        className="font-mono text-sm bg-white dark:bg-gray-900"
                        data-testid="input-webhook-secret"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(newWebhookSecret || "", "Webhook Secret")}
                        data-testid="button-copy-webhook-secret"
                      >
                        {copied === "Webhook Secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => { setNewApiKey(null); setNewWebhookSecret(null); }}
                  data-testid="button-dismiss-credentials"
                >
                  I've saved these credentials
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New API Key</CardTitle>
              <CardDescription>Generate a new API key for your application</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Application Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Application"
                    required
                    data-testid="input-app-name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL (optional)</Label>
                  <Input
                    id="webhookUrl"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-app.com/webhook"
                    type="url"
                    data-testid="input-webhook-url"
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll send payment notifications to this URL
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-create">
                    {createMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        Create API Key
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your API Keys</CardTitle>
            <CardDescription>Manage existing API keys and their permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : !tenantsData?.tenants?.length ? (
              <div className="text-center py-8">
                <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No API keys yet</p>
                <Button onClick={() => setShowForm(true)} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First API Key
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {tenantsData.tenants.map((tenant) => (
                  <div 
                    key={tenant.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`tenant-${tenant.id}`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" data-testid={`text-tenant-name-${tenant.id}`}>
                          {tenant.name}
                        </span>
                        <Badge variant={tenant.isActive ? "default" : "secondary"}>
                          {tenant.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono" data-testid={`text-api-key-${tenant.id}`}>
                          {visibleKeys.has(tenant.id) ? tenant.apiKey : "••••••••••••"}
                        </code>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => toggleKeyVisibility(tenant.id)}
                          data-testid={`button-toggle-key-${tenant.id}`}
                        >
                          {visibleKeys.has(tenant.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(tenant.apiKey, `Key ${tenant.id}`)}
                          data-testid={`button-copy-key-${tenant.id}`}
                        >
                          {copied === `Key ${tenant.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      {tenant.webhookUrl && (
                        <p className="text-xs text-muted-foreground truncate">
                          Webhook: {tenant.webhookUrl}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(tenant.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-8" />

        <Card>
          <CardHeader>
            <CardTitle>Usage Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. Use your API key in requests</h4>
              <code className="block bg-muted p-3 rounded text-sm font-mono">
                Authorization: Bearer YOUR_API_KEY
              </code>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. Example: Create a payment</h4>
              <pre className="bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
{`curl -X POST https://your-domain.com/api/payments/initiate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "planId": "plan-id",
    "externalUserId": "user-123",
    "senderAddress": "0x...",
    "network": "arbitrum",
    "token": "USDC"
  }'`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
