"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvoiceTable } from "@/components/InvoiceTable";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";

export default function QueryInvoice() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    numero: "",
    status: "all",
    customer_name: "",
  });

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
    setLoading(true);

    try {
      const invoicesRef = collection(db, "invoices");
      const constraints = [where("user_id", "==", user.uid)];

      // Note: Firestore doesn't support case-insensitive or partial string matching natively
      // For production, you'd want to use Algolia or implement proper text search
      // For now, we'll do exact matches and filter in memory for partial matches

      if (filters.status && filters.status !== "all") {
        constraints.push(where("status", "==", filters.status));
      }

      const q = query(
        invoicesRef,
        ...constraints,
        orderBy("created_at", "desc")
      );

      const querySnapshot = await getDocs(q);
      let invoicesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Client-side filtering for numero and customer_name (case-insensitive partial match)
      if (filters.numero) {
        invoicesData = invoicesData.filter((invoice: any) =>
          invoice.numero?.toLowerCase().includes(filters.numero.toLowerCase())
        );
      }

      if (filters.customer_name) {
        invoicesData = invoicesData.filter((invoice: any) =>
          invoice.customer_name?.toLowerCase().includes(filters.customer_name.toLowerCase())
        );
      }

      setInvoices(invoicesData);

      if (invoicesData.length === 0) {
        toast({
          title: "No Results",
          description: "No invoices found matching your criteria",
        });
      }
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

  const handleClear = () => {
    setFilters({
      numero: "",
      status: "all",
      customer_name: "",
    });
    setInvoices([]);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8 bg-background">
          <div className="max-w-6xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold">Query NFC-e</h1>
              <p className="text-muted-foreground mt-2">Search for invoices in the system</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Search Filters</CardTitle>
                <CardDescription>Enter your search criteria</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numero">Invoice Number</Label>
                      <Input
                        id="numero"
                        placeholder="Search by number..."
                        value={filters.numero}
                        onChange={(e) => setFilters({ ...filters, numero: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_name">Customer Name</Label>
                      <Input
                        id="customer_name"
                        placeholder="Search by name..."
                        value={filters.customer_name}
                        onChange={(e) => setFilters({ ...filters, customer_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) => setFilters({ ...filters, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="authorized">Authorized</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      Search
                    </Button>
                    <Button type="button" variant="outline" onClick={handleClear}>
                      Clear
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {invoices.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Results ({invoices.length})</h2>
                <InvoiceTable invoices={invoices} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
