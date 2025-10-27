"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
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
import { FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      const invoicesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

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
                  <InvoiceTable invoices={getFilteredInvoices("nfce")} />
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
                  <InvoiceTable invoices={getFilteredInvoices("nfe")} />
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
                  <InvoiceTable invoices={getFilteredInvoices("nfse")} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
