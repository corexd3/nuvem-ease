"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, handleDownloadInvoiceXML } from "@/lib/firebase";
import { onAuthStateChanged, } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc
} from "firebase/firestore";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatsCard } from "@/components/StatsCard";
import { InvoiceTable } from "@/components/InvoiceTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import {httpsCallable} from "firebase/functions";

interface DashboardStats {
  total: number;
  authorized: number;
  cancelled: number;
  pending: number;
}

export default function Dashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>("nfce");
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    authorized: 0,
    cancelled: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setLoading(false);
        router.push("/auth");
        return;
      }

      setUser(currentUser);
      await loadDashboardData(currentUser.uid);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadDashboardData = async (userId: string) => {
    try {
      // Get invoices from Firestore
      const invoicesRef = collection(db, "invoices");
      const q = query(
        invoicesRef,
        where("user_id", "==", userId),
        orderBy("created_at", "desc"),
        limit(100)
      );

      const querySnapshot = await getDocs(q);
      const invoicesData = querySnapshot.docs.map(doc => {
        const data = doc.data();

        // Debug: Log the first invoice to see what data we have
        if (querySnapshot.docs.indexOf(doc) === 0) {
          console.log('First invoice raw data:', data);
          console.log('Destinatario:', data.destinatario);
          console.log('Raw response:', data.raw_response);
        }

        // Extract customer name from destinatario if not already set
        let customerName = data.customer_name;
        if (!customerName && data.destinatario) {
          customerName = data.destinatario.nome ||
                        data.destinatario.xNome ||
                        data.destinatario.razao_social ||
                        data.destinatario.xFant ||
                        null;
        }

        // Extract CPF/CNPJ
        let customerDocument = null;
        if (data.destinatario) {
          customerDocument = data.destinatario.cpf ||
                           data.destinatario.CPF ||
                           data.destinatario.cnpj ||
                           data.destinatario.CNPJ ||
                           null;
        }

        // Get invoice number from various sources
        let numero = data.numero;

        // Try to get from raw_response
        if (!numero && data.raw_response) {
          numero = data.raw_response.numero || data.raw_response.numero_nfe;
        }

        // If still no number, generate a temporary one from nfe_id or doc id
        if (!numero) {
          if (data.nfe_id) {
            numero = `NFe-${data.nfe_id.substring(0, 8)}`;
          } else {
            numero = `INV-${doc.id.substring(0, 8)}`;
          }
        }

        // Convert Firestore Timestamp to ISO string for date formatting
        let issuedAt = null;
        const timestamp = data.created_at || data.issued_at;
        if (timestamp) {
          // Firestore Timestamp has toDate() method
          if (timestamp.toDate) {
            issuedAt = timestamp.toDate().toISOString();
          } else if (timestamp instanceof Date) {
            issuedAt = timestamp.toISOString();
          } else if (typeof timestamp === 'string') {
            issuedAt = timestamp;
          }
        }

        const mappedInvoice = {
          id: doc.id,
          ...data,
          // Map fields for InvoiceTable component compatibility
          issued_at: issuedAt,
          customer_name: customerName,
          customer_document: customerDocument,
          numero: numero || "—",
          total_value: data.total_value || data.valor_total || 0
        };

        // Debug: Log the first mapped invoice
        if (querySnapshot.docs.indexOf(doc) === 0) {
          console.log('First invoice mapped:', mappedInvoice);
        }

        return mappedInvoice;
      }) as any[];

      setInvoices(invoicesData);
      calculateStats(invoicesData, activeTab);
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

  const calculateStats = (invoicesData: any[], invoiceType: string) => {
    // Filter invoices by type (default to 'nfce' if not specified)
    const filteredInvoices = invoicesData.filter(
      (i: any) => (i.invoice_type || "nfce") === invoiceType
    );

    const total = filteredInvoices.length;
    const authorized = filteredInvoices.filter((i: any) => i.status === "authorized").length;
    const cancelled = filteredInvoices.filter((i: any) => i.status === "cancelled").length;
    const pending = filteredInvoices.filter((i: any) => i.status === "pending").length;

    setStats({ total, authorized, cancelled, pending });
  };

  useEffect(() => {
    if (invoices.length > 0) {
      calculateStats(invoices, activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getFilteredInvoices = (invoiceType: string) => {
    return invoices.filter((i: any) => (i.invoice_type || "nfce") === invoiceType);
  };

  const handleViewDetails = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowDetailsModal(true);
  };

  const handleDownloadXML = async (invoice: any) => {
    try {
      toast({
        title: "Downloading...",
        description: "Downloading NF-e XML file",
      });

      const result: any = await handleDownloadInvoiceXML(invoice.id);

      if (result.success && result.xml) {
        // Create a blob from the XML string
        const blob = new Blob([result.xml], { type: 'application/xml' });
        const url = window.URL.createObjectURL(blob);

        // Create a temporary link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `nfe_${result.nfe_id || invoice.nfe_id || invoice.numero}.xml`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Success",
          description: "NF-e XML downloaded successfully",
        });
      } else {
        throw new Error("No XML content received");
      }
    } catch (error: any) {
      console.error('Download XML error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to download XML",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8 bg-background">
          <div className="max-w-7xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Overview of your tax invoices
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="nfce">NFC-e</TabsTrigger>
                <TabsTrigger value="nfe">NF-e</TabsTrigger>
                <TabsTrigger value="nfse">NFS-e</TabsTrigger>
              </TabsList>

              <TabsContent value="nfce" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCard
                    title="Total Invoices"
                    value={stats.total}
                    icon={FileText}
                    variant="default"
                  />
                  <StatsCard
                    title="Authorized"
                    value={stats.authorized}
                    icon={CheckCircle}
                    variant="success"
                  />
                  <StatsCard
                    title="Cancelled"
                    value={stats.cancelled}
                    icon={XCircle}
                    variant="destructive"
                  />
                  <StatsCard
                    title="Pending"
                    value={stats.pending}
                    icon={Clock}
                    variant="warning"
                  />
                </div>
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Recent NFC-e Invoices</h2>
                  <InvoiceTable
                    invoices={getFilteredInvoices("nfce")}
                    onViewDetails={handleViewDetails}
                    onDownloadXML={handleDownloadXML}
                  />
                </div>
              </TabsContent>

              <TabsContent value="nfe" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCard
                    title="Total Invoices"
                    value={stats.total}
                    icon={FileText}
                    variant="default"
                  />
                  <StatsCard
                    title="Authorized"
                    value={stats.authorized}
                    icon={CheckCircle}
                    variant="success"
                  />
                  <StatsCard
                    title="Cancelled"
                    value={stats.cancelled}
                    icon={XCircle}
                    variant="destructive"
                  />
                  <StatsCard
                    title="Pending"
                    value={stats.pending}
                    icon={Clock}
                    variant="warning"
                  />
                </div>
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Recent NF-e Invoices</h2>
                  <InvoiceTable
                    invoices={getFilteredInvoices("nfe")}
                    onViewDetails={handleViewDetails}
                    onDownloadXML={handleDownloadXML}
                  />
                </div>
              </TabsContent>

              <TabsContent value="nfse" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCard
                    title="Total Invoices"
                    value={stats.total}
                    icon={FileText}
                    variant="default"
                  />
                  <StatsCard
                    title="Authorized"
                    value={stats.authorized}
                    icon={CheckCircle}
                    variant="success"
                  />
                  <StatsCard
                    title="Cancelled"
                    value={stats.cancelled}
                    icon={XCircle}
                    variant="destructive"
                  />
                  <StatsCard
                    title="Pending"
                    value={stats.pending}
                    icon={Clock}
                    variant="warning"
                  />
                </div>
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Recent NFS-e Invoices</h2>
                  <InvoiceTable
                    invoices={getFilteredInvoices("nfse")}
                    onViewDetails={handleViewDetails}
                    onDownloadXML={handleDownloadXML}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Invoice Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Detailed information about invoice {selectedInvoice?.numero || selectedInvoice?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Invoice Number</label>
                  <p className="text-base">{selectedInvoice.numero || "—"}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Status</label>
                  <p className="text-base capitalize">{selectedInvoice.status || "—"}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Total Value</label>
                  <p className="text-base">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(selectedInvoice.total_value || selectedInvoice.valor_total || 0))}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Date</label>
                  <p className="text-base">
                    {selectedInvoice.issued_at && !isNaN(new Date(selectedInvoice.issued_at).getTime())
                      ? format(new Date(selectedInvoice.issued_at), "dd/MM/yyyy HH:mm")
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Customer Information */}
              {selectedInvoice.destinatario && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                    <div>
                      <label className="text-sm font-semibold text-muted-foreground">Name</label>
                      <p className="text-base">
                        {selectedInvoice.customer_name ||
                         selectedInvoice.destinatario?.nome ||
                         selectedInvoice.destinatario?.xNome ||
                         selectedInvoice.destinatario?.razao_social ||
                         selectedInvoice.destinatario?.xFant ||
                         "—"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-muted-foreground">CPF/CNPJ</label>
                      <p className="text-base">
                        {selectedInvoice.customer_document ||
                         selectedInvoice.destinatario?.cpf ||
                         selectedInvoice.destinatario?.CPF ||
                         selectedInvoice.destinatario?.cnpj ||
                         selectedInvoice.destinatario?.CNPJ ||
                         "—"}
                      </p>
                    </div>
                    {selectedInvoice.destinatario.email && (
                      <div>
                        <label className="text-sm font-semibold text-muted-foreground">Email</label>
                        <p className="text-base">{selectedInvoice.destinatario.email}</p>
                      </div>
                    )}
                    {selectedInvoice.destinatario.telefone && (
                      <div>
                        <label className="text-sm font-semibold text-muted-foreground">Phone</label>
                        <p className="text-base">{selectedInvoice.destinatario.telefone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Products */}
              {selectedInvoice.produtos && selectedInvoice.produtos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Products</h3>
                  <div className="space-y-3">
                    {selectedInvoice.produtos.map((produto: any, index: number) => (
                      <div key={index} className="bg-muted/30 p-4 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="text-sm font-semibold text-muted-foreground">Description</label>
                            <p className="text-base">{produto.descricao || "—"}</p>
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-muted-foreground">Code</label>
                            <p className="text-base">{produto.codigo || "—"}</p>
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-muted-foreground">Quantity</label>
                            <p className="text-base">{produto.quantidade || 0}</p>
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-muted-foreground">Unit Price</label>
                            <p className="text-base">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(Number(produto.valor_unitario || 0))}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-muted-foreground">Total</label>
                            <p className="text-base font-semibold">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(Number(produto.valor_total || 0))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* API Response Data (for debugging) */}
              {selectedInvoice.raw_response && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">API Information</h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                    <div>
                      <label className="text-sm font-semibold text-muted-foreground">NF-e ID</label>
                      <p className="text-sm font-mono">{selectedInvoice.nfe_id || "—"}</p>
                    </div>
                    {selectedInvoice.raw_response.chave_acesso && (
                      <div className="col-span-2">
                        <label className="text-sm font-semibold text-muted-foreground">Access Key</label>
                        <p className="text-sm font-mono break-all">{selectedInvoice.raw_response.chave_acesso}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
