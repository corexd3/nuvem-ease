"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, functions, handleCreateInvoice } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
} from "firebase/firestore";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { useToast } from "@/hooks/use-toast";

interface InvoiceItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_value: number;
  total_value: number;
};

export default function IssueInvoice() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), product_name: "", quantity: 1, unit_value: 0, total_value: 0 }
  ]);

  const [formData, setFormData] = useState({
    numero: "",
    serie: "1",
    customer_cpf_cnpj: "",
    customer_name: "",
    customer_email: "",
    payment_method: "money" as const,
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

  const addItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), product_name: "", quantity: 1, unit_value: 0, total_value: 0 }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unit_value") {
          updated.total_value = updated.quantity * updated.unit_value;
        }
        return updated;
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total_value, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const totalValue = calculateTotal();

      // Prepare NFC-e data
      const nfceData = {
        numero: formData.numero,
        serie: formData.serie,
        ambiente: "homologacao",
        cliente: {
          cpf_cnpj: formData.customer_cpf_cnpj,
          nome: formData.customer_name,
          email: formData.customer_email
        },
        pagamento: formData.payment_method,
        total: totalValue,
        itens: items.map(item => ({
          nome: item.product_name,
          quantidade: item.quantity,
          valor_unitario: item.unit_value,
          valor_total: item.total_value
        }))
      };
      // Call NuvemFiscal API to issue NFC-e
      const nfceResponse = httpsCallable(functions, "createInvoice");
      const result = await nfceResponse({...nfceData});
      if(!result.data) {
        throw new Error("Failed to create invoice");
      }
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });

      router.push("/");
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
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Issue NFC-e</h1>
              <p className="text-muted-foreground mt-2">Create a new electronic consumer invoice</p>
            </div>

            <form onSubmit={handleSubmit}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Invoice Information</CardTitle>
                  <CardDescription>Basic invoice details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numero">Invoice Number *</Label>
                      <Input
                        id="numero"
                        value={formData.numero}
                        onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serie">Series</Label>
                      <Input
                        id="serie"
                        value={formData.serie}
                        onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                  <CardDescription>Customer details for this invoice</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Customer Name *</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer_cpf_cnpj">CPF/CNPJ</Label>
                      <Input
                        id="customer_cpf_cnpj"
                        value={formData.customer_cpf_cnpj}
                        onChange={(e) => setFormData({ ...formData, customer_cpf_cnpj: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_email">Email</Label>
                      <Input
                        id="customer_email"
                        type="email"
                        value={formData.customer_email}
                        onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Payment Method *</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value: any) => setFormData({ ...formData, payment_method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="money">Money</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="debit_card">Debit Card</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Products/Services</CardTitle>
                      <CardDescription>Add items to the invoice</CardDescription>
                    </div>
                    <Button type="button" onClick={addItem} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item, index) => (
                    <div key={item.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-2 space-y-2">
                          <Label>Product Name *</Label>
                          <Input
                            value={item.product_name}
                            onChange={(e) => updateItem(item.id, "product_name", e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Value *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_value}
                            onChange={(e) => updateItem(item.id, "unit_value", parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">Total: </span>
                        <span className="font-semibold">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(item.total_value)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total Invoice:</span>
                      <span className="text-2xl font-bold text-primary">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(calculateTotal())}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => router.push("/")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Issue Invoice
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
