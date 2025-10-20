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
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, AlertTriangle, XCircle } from "lucide-react";

export default function CancelInvoice() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
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

  const handleSearch = async () => {
    if (!invoiceNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter an invoice number",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);

    try {
      const invoicesRef = collection(db, "invoices");
      const q = query(
        invoicesRef,
        where("user_id", "==", user.uid),
        where("numero", "==", invoiceNumber)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          title: "Not Found",
          description: "Invoice not found",
          variant: "destructive",
        });
        setInvoice(null);
      } else {
        const invoiceDoc = querySnapshot.docs[0];
        setInvoice({
          id: invoiceDoc.id,
          ...invoiceDoc.data()
        });
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

      setInvoice(null);
      setInvoiceNumber("");
      setCancellationReason("");
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

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8 bg-background">
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold">Cancel NFC-e</h1>
              <p className="text-muted-foreground mt-2">Cancel an existing invoice</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Find Invoice</CardTitle>
                <CardDescription>Enter the invoice number to cancel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="invoice-number">Invoice Number</Label>
                    <Input
                      id="invoice-number"
                      placeholder="Enter invoice number..."
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleSearch} disabled={searching}>
                      {searching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      Search
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {invoice && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Number</p>
                        <p className="font-medium">{invoice.numero}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge
                          variant={
                            invoice.status === "cancelled" ? "destructive" :
                            invoice.status === "authorized" ? "default" : "outline"
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Customer</p>
                        <p className="font-medium">{invoice.customer_name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Value</p>
                        <p className="font-medium">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(Number(invoice.total_value))}
                        </p>
                      </div>
                    </div>

                    {invoice.status === "cancelled" && (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          This invoice is already cancelled
                        </AlertDescription>
                      </Alert>
                    )}

                    {invoice.status === "pending" && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          This invoice is still pending and hasn&apos;t been authorized yet
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {invoice.status !== "cancelled" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Cancellation</CardTitle>
                      <CardDescription>Provide a reason for cancellation</CardDescription>
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
                      <Button
                        onClick={handleCancel}
                        disabled={loading || cancellationReason.length < 15}
                        variant="destructive"
                        className="w-full"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4" />
                        )}
                        Cancel Invoice
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
