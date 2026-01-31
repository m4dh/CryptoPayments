import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Copy, Loader2, ArrowLeft, ArrowRight, Wallet, CreditCard, Clock, CheckCircle2, XCircle, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Step = "plan" | "form" | "instructions" | "status";

interface Plan {
  id: string;
  planKey: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  periodDays: number | null;
  features: string[] | null;
}

interface Network {
  id: string;
  name: string;
  chainId?: number;
  tokens: string[];
  estimatedFee: string;
  confirmationTime: string;
  recommended?: boolean;
}

interface PaymentData {
  paymentId: string;
  receiverAddress: string;
  amount: string;
  token: string;
  network: string;
  expiresAt: string;
  expiresIn: number;
}

interface PaymentStatus {
  paymentId: string;
  status: string;
  amount: string;
  token: string;
  network: string;
  receiverAddress: string;
  expiresAt: string;
  expiresIn: number;
  txHash?: string;
}

export default function PaymentPage() {
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [senderAddress, setSenderAddress] = useState<string>("");
  const [userId] = useState<string>(`user-${Date.now()}`);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ["/api/plans"],
  });

  const { data: networksData, isLoading: networksLoading } = useQuery<{ networks: Network[] }>({
    queryKey: ["/api/networks"],
  });

  const { data: statusData, refetch: refetchStatus } = useQuery<PaymentStatus>({
    queryKey: ["/api/payments", paymentData?.paymentId, "status"],
    queryFn: async () => {
      const res = await fetch(`/api/payments/${paymentData?.paymentId}/status`);
      return res.json();
    },
    enabled: step === "status" && !!paymentData?.paymentId,
    refetchInterval: step === "status" ? 5000 : false,
  });

  const initiateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to initiate payment");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setPaymentData(data);
      setStep("instructions");
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payments/${paymentData?.paymentId}/confirm`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to confirm payment");
      }
      return res.json();
    },
    onSuccess: () => {
      setStep("status");
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep("form");
  };

  const handleFormSubmit = () => {
    if (!selectedPlan || !selectedNetwork || !selectedToken || !senderAddress) {
      setError("Please fill in all fields");
      return;
    }

    initiateMutation.mutate({
      userId,
      planId: selectedPlan.id,
      network: selectedNetwork,
      token: selectedToken,
      senderAddress,
    });
  };

  const handleConfirmPayment = () => {
    confirmMutation.mutate();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedNetworkData = networksData?.networks?.find(n => n.id === selectedNetwork);

  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "text-green-600";
      case "failed": case "expired": return "text-red-600";
      default: return "text-yellow-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed": return <CheckCircle2 className="h-12 w-12 text-green-600" />;
      case "failed": case "expired": return <XCircle className="h-12 w-12 text-red-600" />;
      default: return <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold" data-testid="text-payment-title">Crypto Payment</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-8">
          {["plan", "form", "instructions", "status"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s 
                    ? "bg-primary text-primary-foreground" 
                    : ["plan", "form", "instructions", "status"].indexOf(step) > i 
                      ? "bg-green-600 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-indicator-${s}`}
              >
                {["plan", "form", "instructions", "status"].indexOf(step) > i ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && <div className="w-8 h-0.5 bg-muted" />}
            </div>
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "plan" && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold" data-testid="text-step-title">Choose Your Plan</h2>
              <p className="text-muted-foreground">Select a subscription plan to continue</p>
            </div>

            {plansLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4">
                {plansData?.plans.map((plan) => (
                  <Card 
                    key={plan.id} 
                    className="cursor-pointer hover-elevate transition-all"
                    onClick={() => handlePlanSelect(plan)}
                    data-testid={`card-plan-${plan.planKey}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <div className="text-right">
                          <span className="text-2xl font-bold">${formatPrice(plan.price)}</span>
                          <span className="text-muted-foreground text-sm">/{plan.currency}</span>
                        </div>
                      </div>
                      {plan.description && (
                        <CardDescription>{plan.description}</CardDescription>
                      )}
                    </CardHeader>
                    {plan.features && plan.features.length > 0 && (
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-2">
                          {plan.features.map((feature, idx) => (
                            <Badge key={idx} variant="secondary">{feature}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "form" && selectedPlan && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold" data-testid="text-step-title">Payment Details</h2>
              <p className="text-muted-foreground">Choose your preferred payment method</p>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Selected Plan</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setStep("plan")}>
                    Change
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedPlan.name}</span>
                  <span className="font-bold">${formatPrice(selectedPlan.price)} {selectedPlan.currency}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="network">Network</Label>
                  <Select value={selectedNetwork} onValueChange={(v) => { setSelectedNetwork(v); setSelectedToken(""); }}>
                    <SelectTrigger id="network" data-testid="select-network">
                      <SelectValue placeholder="Select blockchain network" />
                    </SelectTrigger>
                    <SelectContent>
                      {networksData?.networks.map((network) => (
                        <SelectItem key={network.id} value={network.id}>
                          <div className="flex items-center gap-2">
                            <span>{network.name}</span>
                            {network.recommended && (
                              <Badge variant="default" className="text-xs">Recommended</Badge>
                            )}
                            <span className="text-muted-foreground text-xs">({network.estimatedFee})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedNetwork && (
                  <div className="space-y-2">
                    <Label htmlFor="token">Token</Label>
                    <Select value={selectedToken} onValueChange={setSelectedToken}>
                      <SelectTrigger id="token" data-testid="select-token">
                        <SelectValue placeholder="Select token" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedNetworkData?.tokens.map((token) => (
                          <SelectItem key={token} value={token}>{token}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="address">Your Wallet Address</Label>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="address"
                      placeholder={selectedNetwork === "tron" ? "T..." : "0x..."}
                      value={senderAddress}
                      onChange={(e) => setSenderAddress(e.target.value)}
                      data-testid="input-wallet-address"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the wallet address you will send payment from
                  </p>
                </div>

                {selectedNetworkData && (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="font-medium">{selectedNetworkData.name}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Est. fee: {selectedNetworkData.estimatedFee} | Confirmation: {selectedNetworkData.confirmationTime}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep("plan")} data-testid="button-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleFormSubmit} 
                  disabled={!selectedNetwork || !selectedToken || !senderAddress || initiateMutation.isPending}
                  data-testid="button-continue"
                >
                  {initiateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Continue
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {step === "instructions" && paymentData && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold" data-testid="text-step-title">Send Payment</h2>
              <p className="text-muted-foreground">Transfer the exact amount to complete your payment</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Payment Details
                </CardTitle>
                <CardDescription>
                  Expires in {Math.floor(paymentData.expiresIn / 60)} minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm" data-testid="qr-code-container">
                    <QRCodeSVG 
                      value={paymentData.receiverAddress} 
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Scan to copy wallet address</p>
                </div>

                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Amount to Send</p>
                  <p className="text-3xl font-bold" data-testid="text-payment-amount">
                    {formatPrice(paymentData.amount)} {paymentData.token}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">on {paymentData.network.charAt(0).toUpperCase() + paymentData.network.slice(1)}</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Send to Address</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={paymentData.receiverAddress} 
                      readOnly 
                      disabled
                      className="font-mono text-sm bg-muted text-muted-foreground cursor-not-allowed"
                      data-testid="input-receiver-address"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(paymentData.receiverAddress)}
                      data-testid="button-copy-address"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <AlertDescription className="text-sm">
                    Send <strong>exactly {formatPrice(paymentData.amount)} {paymentData.token}</strong> from your wallet to the address above. After sending, click "I have paid" below.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep("form")} data-testid="button-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleConfirmPayment}
                  disabled={confirmMutation.isPending}
                  data-testid="button-confirm-payment"
                >
                  {confirmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  I have paid
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {step === "status" && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold" data-testid="text-step-title">Payment Status</h2>
              <p className="text-muted-foreground">Waiting for blockchain confirmation</p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4 py-8">
                  {getStatusIcon(statusData?.status || "pending")}
                  <div className="text-center">
                    <p className={`text-xl font-semibold ${getStatusColor(statusData?.status || "pending")}`} data-testid="text-payment-status">
                      {statusData?.status === "confirmed" ? "Payment Confirmed!" :
                       statusData?.status === "failed" ? "Payment Failed" :
                       statusData?.status === "expired" ? "Payment Expired" :
                       "Waiting for Confirmation..."}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {statusData?.status === "confirmed" 
                        ? "Your subscription has been activated"
                        : statusData?.status === "failed" || statusData?.status === "expired"
                          ? "Please try again or contact support"
                          : "This may take a few minutes"}
                    </p>
                  </div>

                  {statusData?.txHash && (
                    <div className="w-full mt-4">
                      <Label className="text-sm">Transaction Hash</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input 
                          value={statusData.txHash} 
                          readOnly 
                          className="font-mono text-xs"
                          data-testid="input-tx-hash"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => copyToClipboard(statusData.txHash!)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {(statusData?.status === "failed" || statusData?.status === "expired") && (
                  <div className="flex justify-center">
                    <Button onClick={() => { setStep("plan"); setPaymentData(null); }} data-testid="button-try-again">
                      Try Again
                    </Button>
                  </div>
                )}

                {statusData?.status === "confirmed" && (
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" onClick={() => { setStep("plan"); setPaymentData(null); setSelectedPlan(null); }} data-testid="button-new-payment">
                      Make Another Payment
                    </Button>
                    <Button onClick={() => window.location.href = "/"} data-testid="button-done">
                      Done
                    </Button>
                  </div>
                )}

                {(statusData?.status === "pending" || statusData?.status === "awaiting_confirmation" || !statusData?.status || statusData?.status === "awaiting_payment") && (
                  <div className="flex justify-center mt-4">
                    <Button variant="ghost" onClick={() => { setStep("plan"); setPaymentData(null); setSelectedPlan(null); }} data-testid="button-new-payment">
                      Make Another Payment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
