"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NFCeForm } from "@/components/forms/NFCeForm";
import { NFeForm } from "@/components/forms/NFeForm";
import { NFSeForm } from "@/components/forms/NFSeForm";

export default function IssuePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    return () => unsubscribe();
  }, [router]);

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
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Issue Tax Invoice</h1>
              <p className="text-muted-foreground mt-2">
                Create electronic tax invoices (NF-e, NFC-e, NFS-e)
              </p>
            </div>

            <Tabs defaultValue="nfce" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="nfce">NFC-e (Consumer)</TabsTrigger>
                <TabsTrigger value="nfe">NF-e (Products)</TabsTrigger>
                <TabsTrigger value="nfse">NFS-e (Services)</TabsTrigger>
              </TabsList>

              <TabsContent value="nfce" className="mt-6" forceMount>
                {<NFCeForm />}
              </TabsContent>

              <TabsContent value="nfe" className="mt-6" forceMount>
                {<NFeForm />}
              </TabsContent>

              <TabsContent value="nfse" className="mt-6" forceMount>
                {<NFSeForm />}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
