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
  limit,
  getDocs,
} from "firebase/firestore";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatsCard } from "@/components/StatsCard";
import { InvoiceTable } from "@/components/InvoiceTable";
import { FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
        limit(10)
      );

      const querySnapshot = await getDocs(q);
      const invoicesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      setInvoices(invoicesData);

      // Calculate stats
      const total = invoicesData.length;
      const authorized = invoicesData.filter((i: any) => i.status === "authorized").length;
      const cancelled = invoicesData.filter((i: any) => i.status === "cancelled").length;
      const pending = invoicesData.filter((i: any) => i.status === "pending").length;

      setStats({ total, authorized, cancelled, pending });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
                Overview of your NFC-e invoices
              </p>
            </div>

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
              <h2 className="text-xl font-semibold">Recent Invoices</h2>
              <InvoiceTable invoices={invoices} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
