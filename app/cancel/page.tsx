"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, handleCancelInvoice } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, XCircle, AlertTriangle } from "lucide-react";

interface CancelInvoiceResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
    currentStatus?: string;
  };
  data?: any;
}

interface FieldErrors {
  invoiceId?: { message: string; example?: string };
  justificativa?: { message: string; example?: string };
}

export default function CancelPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const cancellingRef = useRef(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [result, setResult] = useState<any>(null);
  const mountedRef = useRef(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showValidation, setShowValidation] = useState(false);

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

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};
    let isValid = true;

    // Validate invoice ID
    if (!invoiceId || invoiceId.trim().length === 0) {
      errors.invoiceId = {
        message: "Invoice ID is required",
        example: "Example: abc123def456 (Firestore document ID)"
      };
      isValid = false;
    } else if (invoiceId.trim().length < 10) {
      errors.invoiceId = {
        message: "Invoice ID must be at least 10 characters",
        example: "Example: abc123def456ghi789 (valid Firestore ID)"
      };
      isValid = false;
    }

    // Validate justification
    if (!justificativa || justificativa.trim().length === 0) {
      errors.justificativa = {
        message: "Justification is required",
        example: "Example: Cliente solicitou cancelamento da nota fiscal"
      };
      isValid = false;
    } else if (justificativa.trim().length < 15) {
      errors.justificativa = {
        message: "Justification must be at least 15 characters",
        example: "Example: Cliente solicitou cancelamento da nota fiscal por erro no pedido"
      };
      isValid = false;
    }

    setFieldErrors(errors);
    setShowValidation(!isValid);
    return isValid;
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors below",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    setCancelling(true);
    cancellingRef.current = true;
    setResult(null);

    try {
      console.log('Starting cancellation for invoice:', invoiceId);
      const response = await handleCancelInvoice({
        invoice_id: invoiceId,
        justificativa
      }) as CancelInvoiceResponse;
      console.log('Cancel response received:', response);

      // Check if the response indicates a validation error (not a thrown error)
      if (response && !response.success && response.error) {
        console.log('Cancellation validation error:', response.error);
        if (mountedRef.current) {
          toast({
            title: "❌ Cannot Cancel Invoice",
            description: response.error.message,
            variant: "destructive",
            duration: 6000,
          });
          setResult(null);
        }
        return;
      }

      // Success case - only update UI if still mounted
      if (mountedRef.current) {
        setResult(response);
        toast({
          title: "✅ Success",
          description: "Invoice cancelled successfully",
        });
        setInvoiceId("");
        setJustificativa("");
      }
    } catch (error: any) {
      console.error("Cancellation error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        stack: error.stack
      });

      if (!mountedRef.current) {
        console.log('Component unmounted, skipping error toast');
        return;
      }

      // Extract detailed error message
      let errorMessage = error.message || "Failed to cancel invoice";

      // Check if there's a NuvemFiscal API error
      if (error.details?.error?.message) {
        errorMessage = `${errorMessage}: ${error.details.error.message}`;
      }

      toast({
        title: "❌ Cannot Cancel Invoice",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });

      setResult(null);
    } finally {
      console.log('Cancel finally block, mounted:', mountedRef.current, 'cancelling:', cancellingRef.current);
      // ALWAYS reset loading state if it was set, even if component is unmounting
      // This prevents the button from staying in loading state
      if (cancellingRef.current) {
        setCancelling(false);
        cancellingRef.current = false;
        console.log('Loading state reset');
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
                  <br />
                  <strong>Note:</strong> Only invoices with &quot;authorized&quot; status can be cancelled. Check the invoice status first in the Query page.
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
                      placeholder="abc123def456ghi789"
                      required
                      className={showValidation && fieldErrors.invoiceId ? 'border-red-500' : ''}
                    />
                    {showValidation && fieldErrors.invoiceId && (
                      <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                        <p>{fieldErrors.invoiceId.message}</p>
                        {fieldErrors.invoiceId.example && (
                          <p className="text-xs text-muted-foreground mt-0.5">{fieldErrors.invoiceId.example}</p>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      Find this ID in the Firestore &quot;invoices&quot; collection
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="justificativa">Justification (min. 15 characters) *</Label>
                    <Input
                      id="justificativa"
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="Cliente solicitou cancelamento da nota fiscal"
                      required
                      minLength={15}
                      className={showValidation && fieldErrors.justificativa ? 'border-red-500' : ''}
                    />
                    {showValidation && fieldErrors.justificativa && (
                      <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                        <p>{fieldErrors.justificativa.message}</p>
                        {fieldErrors.justificativa.example && (
                          <p className="text-xs text-muted-foreground mt-0.5">{fieldErrors.justificativa.example}</p>
                        )}
                      </div>
                    )}
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
