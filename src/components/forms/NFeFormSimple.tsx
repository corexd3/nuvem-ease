"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, TestTube } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getMockNFeData } from "@/utils/mockNFeData";

interface Product {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export function NFeFormSimple() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  // Emittente (Your Company) - Minimal fields
  const [emittente, setEmittente] = useState({
    cpf_cnpj: "",
    inscricao_estadual: "",
    razao_social: "",
    endereco: {
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
      cep: ""
    }
  });

  // Destinatário (Customer)
  const [destinatario, setDestinatario] = useState({
    cpf_cnpj: "",
    razao_social: "",
    endereco: {
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
      cep: ""
    }
  });

  // Products
  const [produtos, setProdutos] = useState<Product[]>([{
    codigo: "",
    descricao: "",
    ncm: "",
    cfop: "5102", // Default: Sale within state
    unidade: "UN",
    quantidade: 1,
    valor_unitario: 0,
    valor_total: 0
  }]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fillMockData = () => {
    const mockData = getMockNFeData();
    setEmittente(mockData.emittente);
    setDestinatario(mockData.destinatario);
    setProdutos(mockData.produtos);
    toast({
      title: "Test Data Loaded",
      description: "Form filled with mock data for sandbox testing",
    });
  };

  const addProduct = () => {
    setProdutos([...produtos, {
      codigo: "",
      descricao: "",
      ncm: "",
      cfop: "5102",
      unidade: "UN",
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0
    }]);
  };

  const removeProduct = (index: number) => {
    if (produtos.length > 1) {
      setProdutos(produtos.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (index: number, field: keyof Product, value: any) => {
    const updated = [...produtos];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantidade' || field === 'valor_unitario') {
      updated[index].valor_total = updated[index].quantidade * updated[index].valor_unitario;
    }

    setProdutos(updated);
  };

  const calculateTotal = () => {
    return produtos.reduce((sum, p) => sum + p.valor_total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get the user's auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }
      const token = await user.getIdToken();

      // Call Next.js API route instead of Firebase Function
      const response = await fetch('/api/nfe/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          emittente,
          destinatario,
          produtos,
          pagamento: {
            formas_pagamento: [{
              forma_pagamento: "01",
              valor: calculateTotal()
            }]
          }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to issue NF-e');
      }

      if (mountedRef.current) {
        toast({
          title: "Success",
          description: "NF-e issued successfully",
        });
        router.push("/");
      }
    } catch (error: any) {
      if (mountedRef.current) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Test Data Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={fillMockData}
          variant="outline"
          className="gap-2"
        >
          <TestTube className="h-4 w-4" />
          Fill Test Data (Sandbox)
        </Button>
      </div>

      {/* Emittente */}
      <Card>
        <CardHeader>
          <CardTitle>Emittente (Your Company)</CardTitle>
          <CardDescription>Company issuing the invoice</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CNPJ *</Label>
              <Input
                value={emittente.cpf_cnpj}
                onChange={(e) => setEmittente({ ...emittente, cpf_cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                required
              />
            </div>
            <div>
              <Label>Inscrição Estadual *</Label>
              <Input
                value={emittente.inscricao_estadual}
                onChange={(e) => setEmittente({ ...emittente, inscricao_estadual: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <Label>Razão Social *</Label>
            <Input
              value={emittente.razao_social}
              onChange={(e) => setEmittente({ ...emittente, razao_social: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Logradouro *</Label>
              <Input
                value={emittente.endereco.logradouro}
                onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, logradouro: e.target.value }})}
                required
              />
            </div>
            <div>
              <Label>Número *</Label>
              <Input
                value={emittente.endereco.numero}
                onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, numero: e.target.value }})}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Bairro *</Label>
              <Input
                value={emittente.endereco.bairro}
                onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, bairro: e.target.value }})}
                required
              />
            </div>
            <div>
              <Label>Cidade *</Label>
              <Input
                value={emittente.endereco.cidade}
                onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, cidade: e.target.value }})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>UF *</Label>
                <Input
                  value={emittente.endereco.uf}
                  onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, uf: e.target.value }})}
                  maxLength={2}
                  required
                />
              </div>
              <div>
                <Label>CEP *</Label>
                <Input
                  value={emittente.endereco.cep}
                  onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, cep: e.target.value }})}
                  required
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Destinatário */}
      <Card>
        <CardHeader>
          <CardTitle>Destinatário (Customer)</CardTitle>
          <CardDescription>Customer receiving the invoice</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CPF/CNPJ *</Label>
              <Input
                value={destinatario.cpf_cnpj}
                onChange={(e) => setDestinatario({ ...destinatario, cpf_cnpj: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Razão Social/Nome *</Label>
              <Input
                value={destinatario.razao_social}
                onChange={(e) => setDestinatario({ ...destinatario, razao_social: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Logradouro *</Label>
              <Input
                value={destinatario.endereco.logradouro}
                onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, logradouro: e.target.value }})}
                required
              />
            </div>
            <div>
              <Label>Número *</Label>
              <Input
                value={destinatario.endereco.numero}
                onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, numero: e.target.value }})}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Bairro *</Label>
              <Input
                value={destinatario.endereco.bairro}
                onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, bairro: e.target.value }})}
                required
              />
            </div>
            <div>
              <Label>Cidade *</Label>
              <Input
                value={destinatario.endereco.cidade}
                onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, cidade: e.target.value }})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>UF *</Label>
                <Input
                  value={destinatario.endereco.uf}
                  onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, uf: e.target.value }})}
                  maxLength={2}
                  required
                />
              </div>
              <div>
                <Label>CEP *</Label>
                <Input
                  value={destinatario.endereco.cep}
                  onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, cep: e.target.value }})}
                  required
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Products</CardTitle>
              <CardDescription>Items to include in the invoice</CardDescription>
            </div>
            <Button type="button" onClick={addProduct} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {produtos.map((produto, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Product {index + 1}</span>
                {produtos.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeProduct(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Code *</Label>
                  <Input
                    value={produto.codigo}
                    onChange={(e) => updateProduct(index, 'codigo', e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-3">
                  <Label>Description *</Label>
                  <Input
                    value={produto.descricao}
                    onChange={(e) => updateProduct(index, 'descricao', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-6 gap-3">
                <div>
                  <Label>NCM *</Label>
                  <Input
                    value={produto.ncm}
                    onChange={(e) => updateProduct(index, 'ncm', e.target.value)}
                    placeholder="00000000"
                    required
                  />
                </div>
                <div>
                  <Label>CFOP *</Label>
                  <Input
                    value={produto.cfop}
                    onChange={(e) => updateProduct(index, 'cfop', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Unit *</Label>
                  <Input
                    value={produto.unidade}
                    onChange={(e) => updateProduct(index, 'unidade', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Qty *</Label>
                  <Input
                    type="number"
                    value={produto.quantidade}
                    onChange={(e) => updateProduct(index, 'quantidade', parseFloat(e.target.value) || 0)}
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <Label>Unit Price *</Label>
                  <Input
                    type="number"
                    value={produto.valor_unitario}
                    onChange={(e) => updateProduct(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <Label>Total</Label>
                  <Input
                    type="number"
                    value={produto.valor_total.toFixed(2)}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="pt-4 border-t flex justify-between items-center">
            <span className="text-lg font-semibold">Total:</span>
            <span className="text-2xl font-bold text-primary">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(calculateTotal())}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.push("/")}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Issue NF-e
        </Button>
      </div>
    </form>
  );
}
