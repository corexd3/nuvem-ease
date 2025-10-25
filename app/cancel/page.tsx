"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,  
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, AlertTriangle, XCircle, CheckCircle2, FileText } from "lucide-react";

type Step = "search" | "confirm" | "cancelled";

export default function CancelInvoice() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("nfce");
  const [currentStep, setCurrentStep] = useState<Step>("search");
  const [invoice, setInvoice] = useState<any>(null);
  const [searchInput, setSearchInput] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/auth");
        return;
      }
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [router]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!searchInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter an invoice number or access key",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);

    try {
      const invoicesRef = collection(db, "invoices");

      // Try searching by invoice number or access key
      const queries = [
        query(
          invoicesRef,
          where("user_id", "==", user.uid),
          where("invoice_type", "==", activeTab),
          where("numero", "==", searchInput)
        ),
        query(
          invoicesRef,
          where("user_id", "==", user.uid),
          where("invoice_type", "==", activeTab),
          where("chave_acesso", "==", searchInput)
        )
      ];

      let found = false;
      for (const q of queries) {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const invoiceDoc = querySnapshot.docs[0];
          setInvoice({
            id: invoiceDoc.id,
            ...invoiceDoc.data()
          });
          setCurrentStep("confirm");
          found = true;
          break;
        }
      }

      if (!found) {
        toast({
          title: "Not Found",
          description: "Invoice not found",
          variant: "destructive",
        });
        setInvoice(null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a cancellation reason",
        variant: "destructive",
      });
      return;
    }

    if (cancellationReason.length < 15) {
      toast({
        title: "Error",
        description: "Cancellation reason must be at least 15 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const invoiceRef = doc(db, "invoices", invoice.id);
      await updateDoc(invoiceRef, {
        status: "cancelled",
        cancellation_reason: cancellationReason,
        cancelled_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Invoice cancelled successfully",
      });

      setCurrentStep("cancelled");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInvoice(null);
    setSearchInput("");
    setCancellationReason("");
    setCurrentStep("search");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      authorized: "default",
      cancelled: "destructive",
      rejected: "destructive",
      pending: "secondary",
      processing: "outline",
    };

    const labels: Record<string, string> = {
      authorized: "Autorizada",
      cancelled: "Cancelada",
      rejected: "Rejeitada",
      pending: "Pendente",
      processing: "Processando",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8 bg-background">
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold">Cancel Invoice</h1>
              <p className="text-muted-foreground mt-2">
                Cancel authorized tax invoices in 3 simple steps
              </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${currentStep === "search" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  1
                </div>
                <span className="ml-2 text-sm font-medium">Search</span>
              </div>
              <div className="w-12 h-0.5 bg-muted" />
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${currentStep === "confirm" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  2
                </div>
                <span className="ml-2 text-sm font-medium">Confirm</span>
              </div>
              <div className="w-12 h-0.5 bg-muted" />
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${currentStep === "cancelled" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  3
                </div>
                <span className="ml-2 text-sm font-medium">Done</span>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="nfce">NFC-e</TabsTrigger>
                <TabsTrigger value="nfe">NF-e</TabsTrigger>
                <TabsTrigger value="nfse">NFS-e</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6 space-y-6">
                {/* Step 1: Search */}
                {currentStep === "search" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Step 1: Find Invoice</CardTitle>
                      <CardDescription>
                        Enter invoice number or access key to search
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSearch} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="search-input">Invoice Number or Access Key</Label>
                          <Input
                            id="search-input"
                            placeholder="Enter invoice number or 44-digit access key..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                          />
                        </div>
                        <Button type="submit" disabled={searching} className="w-full">
                          {searching ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="mr-2 h-4 w-4" />
                          )}
                          Search Invoice
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Step 2: Confirm */}
                {currentStep === "confirm" && invoice && (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-primary" />
                            <div>
                              <CardTitle>Step 2: Invoice Details</CardTitle>
                              <CardDescription>
                                Review the invoice before cancellation
                              </CardDescription>
                            </div>
                          </div>
                          {getStatusBadge(invoice.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Invoice Number</Label>
                            <p className="text-lg font-semibold">{invoice.numero}</p>
                          </div>
                          {invoice.serie && (
                            <div>
                              <Label className="text-muted-foreground">Series</Label>
                              <p className="text-lg font-semibold">{invoice.serie}</p>
                            </div>
                          )}
                          <div>
                            <Label className="text-muted-foreground">Customer</Label>
                            <p className="text-lg font-semibold">{invoice.customer_name || "N/A"}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Total Value</Label>
                            <p className="text-lg font-semibold text-primary">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(invoice.total_value || 0)}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Issue Date</Label>
                            <p className="text-lg font-semibold">
                              {invoice.created_at?.toDate?.()?.toLocaleString("pt-BR") || "N/A"}
                            </p>
                          </div>
                        </div>

                        {invoice.status === "cancelled" && (
                          <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription>
                              This invoice is already cancelled and cannot be cancelled again
                            </AlertDescription>
                          </Alert>
                        )}

                        {invoice.status !== "authorized" && invoice.status !== "cancelled" && (
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              Only authorized invoices can be cancelled. Current status: {invoice.status}
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>

                    {invoice.status === "authorized" && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Cancellation Request</CardTitle>
                          <CardDescription>
                            Provide a detailed reason for cancellation (required by law)
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="reason">Cancellation Reason *</Label>
                            <Textarea
                              id="reason"
                              placeholder="Explain why this invoice is being cancelled (minimum 15 characters)..."
                              value={cancellationReason}
                              onChange={(e) => setCancellationReason(e.target.value)}
                              rows={4}
                              minLength={15}
                            />
                            <p className="text-xs text-muted-foreground">
                              {cancellationReason.length} / 15 characters minimum
                            </p>
                          </div>
                          <div className="flex gap-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleReset}
                              className="flex-1"
                            >
                              Back to Search
                            </Button>
                            <Button
                              onClick={handleCancel}
                              disabled={loading || cancellationReason.length < 15}
                              variant="destructive"
                              className="flex-1"
                            >
                              {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                              )}
                              Confirm Cancellation
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {invoice.status !== "authorized" && (
                      <div className="flex justify-center">
                        <Button onClick={handleReset}>
                          Back to Search
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* Step 3: Success */}
                {currentStep === "cancelled" && invoice && (
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900">
                          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">Cancellation Successful!</CardTitle>
                          <CardDescription className="mt-2">
                            Invoice #{invoice.numero} has been successfully cancelled
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Invoice Number</Label>
                            <p className="font-semibold">{invoice.numero}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Status</Label>
                            <div className="mt-1">{getStatusBadge("cancelled")}</div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Cancellation Reason</Label>
                          <p className="text-sm mt-1">{cancellationReason}</p>
                        </div>
                      </div>

                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          The cancellation has been recorded. This action is irreversible.
                        </AlertDescription>
                      </Alert>

                      <div className="flex gap-4">
                        <Button onClick={() => router.push("/")} variant="outline" className="flex-1">
                          Go to Dashboard
                        </Button>
                        <Button onClick={handleReset} className="flex-1">
                          Cancel Another Invoice
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
