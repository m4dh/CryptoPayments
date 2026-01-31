import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, ExternalLink, Zap, Shield, Globe, Code } from "lucide-react";
import { useState } from "react";
import futureAndCodeLogo from "@/assets/futureandcode_czarne_x100.svg";

export default function Home() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2 h-8 w-8"
      onClick={() => copyToClipboard(text, id)}
      data-testid={`button-copy-${id}`}
    >
      {copiedCode === id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );

  const initCode = `// Import the crypto payments library directly
import { cryptoPayments } from './lib/cryptoPayments';

// Configure payment addresses (or use env vars)
cryptoPayments.configure({
  paymentAddressEvm: '0x...',
  paymentAddressTron: 'T...',
});`;

  const paymentCode = `// Initiate a payment
const payment = await cryptoPayments.initiatePayment({
  userId: 'user-123',
  planId: 'pro-monthly',
  network: 'arbitrum',
  token: 'USDC',
  senderAddress: '0x...',
});

// Confirm payment after user sends transaction
await cryptoPayments.confirmPaymentSent(payment.paymentId);

// Get payment status
const status = await cryptoPayments.getPaymentStatus(payment.paymentId);`;

  const webhookCode = `// Webhook notification example (optional)
import { webhookService } from './services/webhookService';

// Configure webhook URL for notifications
webhookService.configure({
  url: 'https://your-app.com/webhooks',
  secret: 'your-secret',
});

// Events: payment.confirmed, payment.expired, subscription.activated`;

  const curlExample = `# Native library - no API calls needed!
# Simply import and use directly in your code:

import { cryptoPayments } from './lib/cryptoPayments';

const payment = await cryptoPayments.initiatePayment({
  userId: 'user-123',
  planId: 'pro-monthly',
  network: 'arbitrum',
  token: 'USDC',
  senderAddress: '0x...',
});`;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold" data-testid="text-title">Crypto Payment Library</h1>
                <p className="text-sm text-muted-foreground">USDT/USDC payments on Arbitrum, Ethereum, Tron</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild data-testid="button-try-payment">
                <a href="/pay">Try Payment Demo</a>
              </Button>
              <Badge variant="secondary" data-testid="badge-version">v2.0.0</Badge>
              <Badge variant="outline" className="text-green-600 border-green-600" data-testid="badge-status">
                Operational
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card data-testid="card-feature-networks">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Multi-Network</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Support for multiple blockchain networks with optimized gas fees
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge>Arbitrum</Badge>
                <Badge variant="secondary">Ethereum</Badge>
                <Badge variant="secondary">Tron</Badge>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-security">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Secure</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                AES-256-GCM encryption, HMAC verification, and blockchain confirmations
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Encrypted</Badge>
                <Badge variant="outline">Verified</Badge>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-sdk">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Easy Integration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                TypeScript SDK with full type definitions and webhook support
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">TypeScript</Badge>
                <Badge variant="outline">Webhooks</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card data-testid="card-quickstart">
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>Import and use the library directly in your code</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="setup" className="w-full">
                <TabsList className="grid w-full grid-cols-2" data-testid="tabs-code-examples">
                  <TabsTrigger value="setup">Setup</TabsTrigger>
                  <TabsTrigger value="usage">Usage</TabsTrigger>
                </TabsList>
                <TabsContent value="setup" className="mt-4">
                  <div className="relative">
                    <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
                      <code>{initCode}</code>
                    </pre>
                    <CopyButton text={initCode} id="init" />
                  </div>
                </TabsContent>
                <TabsContent value="usage" className="mt-4">
                  <div className="relative">
                    <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
                      <code>{curlExample}</code>
                    </pre>
                    <CopyButton text={curlExample} id="curl" />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card data-testid="card-endpoints">
            <CardHeader>
              <CardTitle>API Endpoints</CardTitle>
              <CardDescription>Available REST API endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                <div className="space-y-3">
                  <EndpointItem method="GET" path="/api/plans" description="List available plans" />
                  <EndpointItem method="GET" path="/api/networks" description="Get supported networks" />
                  <EndpointItem method="POST" path="/api/payments" description="Initiate payment" />
                  <EndpointItem method="POST" path="/api/payments/:id/confirm" description="Confirm payment sent" />
                  <EndpointItem method="GET" path="/api/payments/:id/status" description="Check payment status" />
                  <EndpointItem method="GET" path="/api/health" description="Health check" />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-testid="card-payment-flow">
            <CardHeader>
              <CardTitle>Payment Flow</CardTitle>
              <CardDescription>Complete payment integration example</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
                  <code>{paymentCode}</code>
                </pre>
                <CopyButton text={paymentCode} id="payment" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-webhooks">
            <CardHeader>
              <CardTitle>Webhook Integration</CardTitle>
              <CardDescription>Receive real-time payment notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
                  <code>{webhookCode}</code>
                </pre>
                <CopyButton text={webhookCode} id="webhook" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8" data-testid="card-supported-tokens">
          <CardHeader>
            <CardTitle>Supported Networks & Tokens</CardTitle>
            <CardDescription>Available payment options with fee estimates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <NetworkCard 
                name="Arbitrum" 
                tokens={["USDT", "USDC"]} 
                fee="~$0.01" 
                time="~1 min"
                recommended 
              />
              <NetworkCard 
                name="Tron" 
                tokens={["USDT", "USDC"]} 
                fee="~$0.50" 
                time="~3 min"
              />
              <NetworkCard 
                name="Ethereum" 
                tokens={["USDT", "USDC"]} 
                fee="~$2-5" 
                time="~5 min"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="border-t bg-card mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>Crypto Payment Library - Native USDT/USDC payment integration</p>
            <a 
              href="https://futureandcode.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              data-testid="link-futureandcode"
            >
              <img 
                src={futureAndCodeLogo} 
                alt="Future and Code" 
                className="h-6"
                data-testid="img-futureandcode-logo"
              />
              <span>futureandcode.com</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function EndpointItem({ method, path, description }: { method: string; path: string; description: string }) {
  const methodColors: Record<string, string> = {
    GET: 'bg-blue-500/10 text-blue-600',
    POST: 'bg-green-500/10 text-green-600',
    PATCH: 'bg-yellow-500/10 text-yellow-600',
    DELETE: 'bg-red-500/10 text-red-600',
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-md hover-elevate">
      <Badge className={`${methodColors[method]} font-mono text-xs min-w-[50px] justify-center`}>
        {method}
      </Badge>
      <code className="text-sm font-mono flex-1">{path}</code>
      <span className="text-xs text-muted-foreground">{description}</span>
    </div>
  );
}

function NetworkCard({ 
  name, 
  tokens, 
  fee, 
  time, 
  recommended 
}: { 
  name: string; 
  tokens: string[]; 
  fee: string; 
  time: string; 
  recommended?: boolean;
}) {
  return (
    <div className={`p-4 rounded-lg border ${recommended ? 'border-primary bg-primary/5' : 'bg-card'}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">{name}</h4>
        {recommended && <Badge variant="default" className="text-xs">Recommended</Badge>}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tokens</span>
          <span>{tokens.join(', ')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Est. Fee</span>
          <span>{fee}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Confirm Time</span>
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}
