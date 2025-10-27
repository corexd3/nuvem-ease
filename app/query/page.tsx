"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, handleQueryInvoice } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

export default function QueryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
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

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuerying(true);
    setResult(null);

    try {
      const response = await handleQueryInvoice({ invoice_id: invoiceId });

      if (mountedRef.current) {
        setResult(response);
        toast({
          title: "✅ Success",
          description: "Invoice status retrieved",
        });
      }
    } catch (error: any) {
      console.error("Query error:", error);

      if (mountedRef.current) {
        // Extract detailed error message
        let errorMessage = error.message || "Failed to query invoice";

        if (error.details?.error?.message) {
          errorMessage = `${errorMessage}: ${error.details.error.message}`;
        }

        toast({
          title: "❌ Error",
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        });

        // Clear previous results
        setResult(null);
      }
    } finally {
      if (mountedRef.current) {
        // Always re-enable the button
        setQuerying(false);
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
              <h1 className="text-3xl font-bold">Query Invoice</h1>
              <p className="text-muted-foreground mt-2">
                Check invoice status from NuvemFiscal
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Invoice Status Query</CardTitle>
                <CardDescription>
                  Enter the invoice ID from Firestore to check its status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleQuery} className="space-y-4">
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
                      Find this ID in the Firestore &quot;invoices&quot; collection
                    </p>
                  </div>

                  <Button type="submit" disabled={querying} className="w-full">
                    {querying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Querying...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Query Invoice
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {result && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Query Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Status:</span>
                      <span className="font-semibold text-primary">{result.status || 'N/A'}</span>
                    </div>
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium">View Full Response</summary>
                      <pre className="mt-2 p-4 bg-muted rounded-lg overflow-x-auto text-xs">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </details>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
