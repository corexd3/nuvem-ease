"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, functions } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, XCircle, AlertTriangle } from "lucide-react";

export default function CancelPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [result, setResult] = useState<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setLoading(false);
        router.push("/auth");
        return;
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [router]);

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (justificativa.length < 15) {
      toast({
        title: "❌ Validation Error",
        description: "Justification must be at least 15 characters",
        variant: "destructive",
      });
      return;
    }

    setCancelling(true);
    setResult(null);

    try {
      const cancelInvoice = httpsCallable(functions, "cancelInvoice");
      const response = await cancelInvoice({
        invoice_id: invoiceId,
        justificativa
      });

      if (mountedRef.current) {
        setResult(response.data);
        toast({
          title: "✅ Success",
          description: "Invoice cancelled successfully",
        });
        setInvoiceId("");
        setJustificativa("");
      }
    } catch (error: any) {
      if (mountedRef.current) {
        toast({
          title: "❌ Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      if (mountedRef.current) {
        setCancelling(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8 bg-background">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Cancel Invoice</h1>
              <p className="text-muted-foreground mt-2">
                Cancel an authorized invoice with justification
              </p>
            </div>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Invoice Cancellation
                </CardTitle>
                <CardDescription>
                  This action cannot be undone. Make sure you have the correct invoice ID.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCancel} className="space-y-4">
                  <div>
                    <Label htmlFor="invoiceId">Invoice ID *</Label>
                    <Input
                      id="invoiceId"
                      value={invoiceId}
                      onChange={(e) => setInvoiceId(e.target.value)}
                      placeholder="Enter invoice ID from Firestore"
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Find this ID in the Firestore "invoices" collection
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="justificativa">Justification (min. 15 characters) *</Label>
                    <Input
                      id="justificativa"
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="Reason for cancellation"
                      required
                      minLength={15}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {justificativa.length}/15 characters minimum
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={cancelling}
                    variant="destructive"
                    className="w-full"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel Invoice
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {result && (
              <Card className="mt-6 border-green-500/50">
                <CardHeader>
                  <CardTitle className="text-green-600">Cancellation Successful</CardTitle>
                </CardHeader>
                <CardContent>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">View Full Response</summary>
                    <pre className="mt-2 p-4 bg-muted rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
