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
  doc,
  getDoc
} from "firebase/firestore";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, FileText } from "lucide-react";

export default function QueryInvoice() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("nfce");
  const [searchMode, setSearchMode] = useState<"filters" | "accesskey">("filters");
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);

  const [filters, setFilters] = useState({
    numero: "",
    status: "all",
    customer_name: "",
    invoice_type: "nfce",
  });

  const [accessKey, setAccessKey] = useState("");

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

  useEffect(() => {
    setFilters(prev => ({ ...prev, invoice_type: activeTab }));
  }, [activeTab]);

  const handleSearchByFilters = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setInvoiceDetails(null);

    try {
      const invoicesRef = collection(db, "invoices");
      const constraints = [
        where("user_id", "==", user.uid),
        where("invoice_type", "==", activeTab)
      ];

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

      // Client-side filtering for numero and customer_name
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

      if (invoicesData.length === 1) {
        setInvoiceDetails(invoicesData[0]);
      } else if (invoicesData.length === 0) {
        toast({
          title: "No Results",
          description: "No invoice found matching your criteria",
        });
      } else {
        toast({
          title: "Multiple Results",
          description: `Found ${invoicesData.length} invoices. Please refine your search.`,
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

  const handleSearchByAccessKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setInvoiceDetails(null);

    try {
      if (!accessKey || accessKey.length !== 44) {
        toast({
          title: "Invalid Access Key",
          description: "Access key must be 44 characters",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const invoicesRef = collection(db, "invoices");
      const q = query(
        invoicesRef,
        where("user_id", "==", user.uid),
        where("chave_acesso", "==", accessKey)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          title: "Not Found",
          description: "No invoice found with this access key",
        });
      } else {
        const invoiceData = {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data()
        };
        setInvoiceDetails(invoiceData);
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
      invoice_type: activeTab,
    });
    setAccessKey("");
    setInvoiceDetails(null);
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
          <div className="max-w-6xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold">Query Invoice</h1>
              <p className="text-muted-foreground mt-2">
                Search for tax invoices by ID or access key
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="nfce">NFC-e</TabsTrigger>
                <TabsTrigger value="nfe">NF-e</TabsTrigger>
                <TabsTrigger value="nfse">NFS-e</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Search Method</CardTitle>
                    <CardDescription>Choose how to search for the invoice</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={searchMode} onValueChange={(v: any) => setSearchMode(v)}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="filters">Search by Filters</TabsTrigger>
                        <TabsTrigger value="accesskey">Search by Access Key</TabsTrigger>
                      </TabsList>

                      <TabsContent value="filters" className="mt-4">
                        <form onSubmit={handleSearchByFilters} className="space-y-4">
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
                      </TabsContent>

                      <TabsContent value="accesskey" className="mt-4">
                        <form onSubmit={handleSearchByAccessKey} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="access_key">Chave de Acesso (Access Key)</Label>
                            <Input
                              id="access_key"
                              placeholder="Enter 44-digit access key..."
                              value={accessKey}
                              onChange={(e) => setAccessKey(e.target.value)}
                              maxLength={44}
                            />
                            <p className="text-sm text-muted-foreground">
                              {accessKey.length}/44 characters
                            </p>
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
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {invoiceDetails && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-primary" />
                          <div>
                            <CardTitle>Invoice Details</CardTitle>
                            <CardDescription>
                              {activeTab.toUpperCase()} #{invoiceDetails.numero}
                            </CardDescription>
                          </div>
                        </div>
                        {getStatusBadge(invoiceDetails.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-muted-foreground">Invoice Number</Label>
                            <p className="text-lg font-semibold">{invoiceDetails.numero}</p>
                          </div>
                          {invoiceDetails.serie && (
                            <div>
                              <Label className="text-muted-foreground">Series</Label>
                              <p className="text-lg font-semibold">{invoiceDetails.serie}</p>
                            </div>
                          )}
                          <div>
                            <Label className="text-muted-foreground">Customer</Label>
                            <p className="text-lg font-semibold">{invoiceDetails.customer_name || "N/A"}</p>
                          </div>
                          {invoiceDetails.customer_cpf_cnpj && (
                            <div>
                              <Label className="text-muted-foreground">CPF/CNPJ</Label>
                              <p className="text-lg font-semibold">{invoiceDetails.customer_cpf_cnpj}</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <div>
                            <Label className="text-muted-foreground">Total Value</Label>
                            <p className="text-2xl font-bold text-primary">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(invoiceDetails.total_value || 0)}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Issue Date</Label>
                            <p className="text-lg font-semibold">
                              {invoiceDetails.created_at?.toDate?.()?.toLocaleString("pt-BR") || "N/A"}
                            </p>
                          </div>
                          {invoiceDetails.chave_acesso && (
                            <div>
                              <Label className="text-muted-foreground">Access Key</Label>
                              <p className="text-sm font-mono break-all">{invoiceDetails.chave_acesso}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {invoiceDetails.cancellation_reason && (
                        <div className="pt-4 border-t">
                          <Label className="text-muted-foreground">Cancellation Reason</Label>
                          <p className="mt-2 text-sm">{invoiceDetails.cancellation_reason}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Cancelled at: {invoiceDetails.cancelled_at?.toDate?.()?.toLocaleString("pt-BR")}
                          </p>
                        </div>
                      )}
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
