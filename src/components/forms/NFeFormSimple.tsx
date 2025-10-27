"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, TestTube, ChevronDown, ChevronUp } from "lucide-react";
import { auth, handleIssueNFe } from "@/lib/firebase";
import { getMockNFeData } from "@/utils/mockNFeData";

interface Product {
  nItem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  cest?: string;
  cean?: string;
  origem: string;
  icms_situacao_tributaria: string;
  icms_aliquota?: number;
  ipi_situacao_tributaria?: string;
  pis_situacao_tributaria?: string;
  cofins_situacao_tributaria?: string;
}

export function NFeFormSimple() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  // NF-e Identification
  const [nfeConfig, setNfeConfig] = useState({
    natureza_operacao: "VENDA",
    tipo_documento: "1",
    finalidade_emissao: "1",
    consumidor_final: "1",
    presenca_comprador: "1",
    ambiente: "homologacao" as "homologacao" | "producao"
  });

  // Emittente (Your Company)
  const [emittente, setEmittente] = useState({
    cpf_cnpj: "",
    inscricao_estadual: "",
    razao_social: "",
    nome_fantasia: "",
    regime_tributario: "1",
    endereco: {
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      codigo_municipio: "",
      cidade: "",
      uf: "",
      cep: "",
      codigo_pais: "1058",
      pais: "Brasil",
      telefone: ""
    }
  });

  // Destinatário (Customer)
  const [destinatario, setDestinatario] = useState({
    cpf_cnpj: "",
    razao_social: "",
    indicador_ie: "9",
    inscricao_estadual: "",
    email: "",
    telefone: "",
    endereco: {
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      codigo_municipio: "",
      cidade: "",
      uf: "",
      cep: "",
      codigo_pais: "1058",
      pais: "Brasil"
    }
  });

  // Products
  const [produtos, setProdutos] = useState<Product[]>([{
    nItem: 1,
    codigo: "",
    descricao: "",
    ncm: "",
    cfop: "5102",
    unidade: "UN",
    quantidade: 1,
    valor_unitario: 0,
    valor_total: 0,
    cest: "",
    cean: "",
    origem: "0",
    icms_situacao_tributaria: "102",
    icms_aliquota: 0,
    ipi_situacao_tributaria: "99",
    pis_situacao_tributaria: "07",
    cofins_situacao_tributaria: "07"
  }]);

  // Transport
  const [transporte, setTransporte] = useState({
    modalidade_frete: "9",
    transportadora: {
      cpf_cnpj: "",
      razao_social: "",
      inscricao_estadual: "",
      endereco: "",
      municipio: "",
      uf: ""
    },
    veiculo: {
      placa: "",
      uf: "",
      rntc: ""
    }
  });

  // Payment
  const [pagamento, setPagamento] = useState({
    formas_pagamento: [{
      indicador_pagamento: "0",
      meio_pagamento: "01",
      valor: 0
    }]
  });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fillMockData = () => {
    const mockData = getMockNFeData();
    setNfeConfig(mockData.nfeConfig);
    setEmittente(mockData.emittente);
    setDestinatario(mockData.destinatario);
    setProdutos(mockData.produtos);
    setTransporte(mockData.transporte);
    setPagamento(mockData.pagamento);
    toast({
      title: "Test Data Loaded",
      description: "Form filled with mock data for sandbox testing",
    });
  };

  const toggleProductExpansion = (index: number) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedProducts(newExpanded);
  };

  const addProduct = () => {
    const newProduct: Product = {
      nItem: produtos.length + 1,
      codigo: "",
      descricao: "",
      ncm: "",
      cfop: "5102",
      unidade: "UN",
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
      cest: "",
      cean: "",
      origem: "0",
      icms_situacao_tributaria: "102",
      icms_aliquota: 0,
      ipi_situacao_tributaria: "99",
      pis_situacao_tributaria: "07",
      cofins_situacao_tributaria: "07"
    };
    setProdutos([...produtos, newProduct]);
  };

  const removeProduct = (index: number) => {
    if (produtos.length > 1) {
      const updated = produtos.filter((_, i) => i !== index);
      updated.forEach((p, i) => p.nItem = i + 1);
      setProdutos(updated);
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
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Issue NF-e
      toast({
        title: "Issuing NF-e",
        description: "Creating invoice...",
      });

      const updatedPagamento = {
        ...pagamento,
        formas_pagamento: pagamento.formas_pagamento.map(fp => ({
          ...fp,
          valor: calculateTotal()
        }))
      };

      console.log("Calling handleIssueNFe...");
      const result = await handleIssueNFe({
        nfeConfig,
        emittente,
        destinatario,
        produtos,
        transporte,
        pagamento: updatedPagamento
      });

      console.log("NF-e issue result:", result);

      // Show success message (toast persists even after component unmounts)
      toast({
        title: "Success",
        description: "NF-e issued successfully! Redirecting to dashboard...",
        duration: 3000, // Toast stays for 3 seconds
      });
      console.log("Success toast shown");

      // Redirect to dashboard after showing the toast
      console.log("Redirecting to dashboard in 2s...");
      setTimeout(() => {
        console.log("Executing redirect now...");
        router.push("/");
      }, 2000);
    } catch (error: any) {
      console.error("NF-e submission error:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        stack: error.stack
      });

      if (mountedRef.current) {
        toast({
          title: "Error",
          description: error.message || "Failed to issue NF-e",
          variant: "destructive",
        });
      }
    } finally {
      if (mountedRef.current) {
        console.log("Setting loading to false");
        setLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Issue NF-e</h2>
          <p className="text-sm text-muted-foreground">Complete invoice issuance form</p>
        </div>
        <Button type="button" onClick={fillMockData} variant="outline" className="gap-2">
          <TestTube className="h-4 w-4" />
          Fill Test Data
        </Button>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="emittente">Issuer</TabsTrigger>
          <TabsTrigger value="destinatario">Customer</TabsTrigger>
          <TabsTrigger value="produtos">Products</TabsTrigger>
          <TabsTrigger value="outros">Other</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>NF-e Configuration</CardTitle>
              <CardDescription>Basic invoice settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Environment *</Label>
                  <Select
                    value={nfeConfig.ambiente}
                    onValueChange={(value: "homologacao" | "producao") =>
                      setNfeConfig({ ...nfeConfig, ambiente: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">Sandbox</SelectItem>
                      <SelectItem value="producao">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Operation Type *</Label>
                  <Input
                    value={nfeConfig.natureza_operacao}
                    onChange={(e) => setNfeConfig({ ...nfeConfig, natureza_operacao: e.target.value })}
                    placeholder="VENDA, DEVOLUCAO"
                    required
                  />
                </div>
                <div>
                  <Label>Document Type *</Label>
                  <Select
                    value={nfeConfig.tipo_documento}
                    onValueChange={(value) => setNfeConfig({ ...nfeConfig, tipo_documento: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - Entrada</SelectItem>
                      <SelectItem value="1">1 - Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Purpose *</Label>
                  <Select
                    value={nfeConfig.finalidade_emissao}
                    onValueChange={(value) => setNfeConfig({ ...nfeConfig, finalidade_emissao: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Normal</SelectItem>
                      <SelectItem value="2">2 - Complementar</SelectItem>
                      <SelectItem value="3">3 - Ajuste</SelectItem>
                      <SelectItem value="4">4 - Devolução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Final Consumer *</Label>
                  <Select
                    value={nfeConfig.consumidor_final}
                    onValueChange={(value) => setNfeConfig({ ...nfeConfig, consumidor_final: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - Normal</SelectItem>
                      <SelectItem value="1">1 - Final Consumer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Buyer Presence *</Label>
                  <Select
                    value={nfeConfig.presenca_comprador}
                    onValueChange={(value) => setNfeConfig({ ...nfeConfig, presenca_comprador: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - N/A</SelectItem>
                      <SelectItem value="1">1 - In Person</SelectItem>
                      <SelectItem value="2">2 - Internet</SelectItem>
                      <SelectItem value="3">3 - Telemarketing</SelectItem>
                      <SelectItem value="9">9 - Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emittente Tab */}
        <TabsContent value="emittente" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Issuer (Your Company)</CardTitle>
              <CardDescription>Company issuing the invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
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
                  <Label>State Registration *</Label>
                  <Input
                    value={emittente.inscricao_estadual}
                    onChange={(e) => setEmittente({ ...emittente, inscricao_estadual: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Tax Regime *</Label>
                  <Select
                    value={emittente.regime_tributario}
                    onValueChange={(value) => setEmittente({ ...emittente, regime_tributario: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Simples Nacional</SelectItem>
                      <SelectItem value="2">2 - Simples Exc. Sublimite</SelectItem>
                      <SelectItem value="3">3 - Regime Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    value={emittente.razao_social}
                    onChange={(e) => setEmittente({ ...emittente, razao_social: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Trade Name</Label>
                  <Input
                    value={emittente.nome_fantasia}
                    onChange={(e) => setEmittente({ ...emittente, nome_fantasia: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label>Street *</Label>
                  <Input
                    value={emittente.endereco.logradouro}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, logradouro: e.target.value }})}
                    required
                  />
                </div>
                <div>
                  <Label>Number *</Label>
                  <Input
                    value={emittente.endereco.numero}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, numero: e.target.value }})}
                    required
                  />
                </div>
                <div>
                  <Label>Complement</Label>
                  <Input
                    value={emittente.endereco.complemento}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, complemento: e.target.value }})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <Label>District *</Label>
                  <Input
                    value={emittente.endereco.bairro}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, bairro: e.target.value }})}
                    required
                  />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    value={emittente.endereco.cidade}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, cidade: e.target.value }})}
                    required
                  />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input
                    value={emittente.endereco.uf}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, uf: e.target.value.toUpperCase() }})}
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
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={emittente.endereco.telefone}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, telefone: e.target.value }})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Destinatario Tab */}
        <TabsContent value="destinatario" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>Customer receiving the invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>CPF/CNPJ *</Label>
                  <Input
                    value={destinatario.cpf_cnpj}
                    onChange={(e) => setDestinatario({ ...destinatario, cpf_cnpj: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label>Name *</Label>
                  <Input
                    value={destinatario.razao_social}
                    onChange={(e) => setDestinatario({ ...destinatario, razao_social: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>IE Indicator *</Label>
                  <Select
                    value={destinatario.indicador_ie}
                    onValueChange={(value) => setDestinatario({ ...destinatario, indicador_ie: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Contributor</SelectItem>
                      <SelectItem value="2">2 - Exempt</SelectItem>
                      <SelectItem value="9">9 - Non-Contributor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>State Registration</Label>
                  <Input
                    value={destinatario.inscricao_estadual}
                    onChange={(e) => setDestinatario({ ...destinatario, inscricao_estadual: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={destinatario.email}
                    onChange={(e) => setDestinatario({ ...destinatario, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={destinatario.telefone}
                    onChange={(e) => setDestinatario({ ...destinatario, telefone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label>Street *</Label>
                  <Input
                    value={destinatario.endereco.logradouro}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, logradouro: e.target.value }})}
                    required
                  />
                </div>
                <div>
                  <Label>Number *</Label>
                  <Input
                    value={destinatario.endereco.numero}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, numero: e.target.value }})}
                    required
                  />
                </div>
                <div>
                  <Label>Complement</Label>
                  <Input
                    value={destinatario.endereco.complemento}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, complemento: e.target.value }})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>District *</Label>
                  <Input
                    value={destinatario.endereco.bairro}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, bairro: e.target.value }})}
                    required
                  />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    value={destinatario.endereco.cidade}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, cidade: e.target.value }})}
                    required
                  />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input
                    value={destinatario.endereco.uf}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, uf: e.target.value.toUpperCase() }})}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="produtos" className="space-y-4">
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
                <div key={index} className="border rounded-lg overflow-hidden">
                  <div className="p-4 bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-6 gap-3">
                          <div>
                            <Label className="text-xs">Code *</Label>
                            <Input
                              value={produto.codigo}
                              onChange={(e) => updateProduct(index, 'codigo', e.target.value)}
                              required
                              size={10}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Description *</Label>
                            <Input
                              value={produto.descricao}
                              onChange={(e) => updateProduct(index, 'descricao', e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">NCM *</Label>
                            <Input
                              value={produto.ncm}
                              onChange={(e) => updateProduct(index, 'ncm', e.target.value)}
                              placeholder="00000000"
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">CFOP *</Label>
                            <Input
                              value={produto.cfop}
                              onChange={(e) => updateProduct(index, 'cfop', e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit *</Label>
                            <Input
                              value={produto.unidade}
                              onChange={(e) => updateProduct(index, 'unidade', e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-6 gap-3">
                          <div>
                            <Label className="text-xs">Qty *</Label>
                            <Input
                              type="number"
                              value={produto.quantidade}
                              onChange={(e) => updateProduct(index, 'quantidade', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Price *</Label>
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
                            <Label className="text-xs">Total</Label>
                            <Input
                              type="number"
                              value={produto.valor_total.toFixed(2)}
                              readOnly
                              className="bg-muted font-semibold"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Origin *</Label>
                            <Select
                              value={produto.origem}
                              onValueChange={(value) => updateProduct(index, 'origem', value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">0 - Nacional</SelectItem>
                                <SelectItem value="1">1 - Estrangeira Imp. Direta</SelectItem>
                                <SelectItem value="2">2 - Estrangeira Adq. Mercado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">ICMS CST *</Label>
                            <Input
                              value={produto.icms_situacao_tributaria}
                              onChange={(e) => updateProduct(index, 'icms_situacao_tributaria', e.target.value)}
                              placeholder="102"
                              required
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleProductExpansion(index)}
                              className="flex-1"
                            >
                              {expandedProducts.has(index) ? (
                                <><ChevronUp className="h-4 w-4 mr-1" /> Less</>
                              ) : (
                                <><ChevronDown className="h-4 w-4 mr-1" /> More</>
                              )}
                            </Button>
                            {produtos.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeProduct(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {expandedProducts.has(index) && (
                          <div className="pt-3 border-t space-y-3">
                            <div className="grid grid-cols-5 gap-3">
                              <div>
                                <Label className="text-xs">CEST</Label>
                                <Input
                                  value={produto.cest || ""}
                                  onChange={(e) => updateProduct(index, 'cest', e.target.value)}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">CEAN/EAN</Label>
                                <Input
                                  value={produto.cean || ""}
                                  onChange={(e) => updateProduct(index, 'cean', e.target.value)}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">ICMS Rate (%)</Label>
                                <Input
                                  type="number"
                                  value={produto.icms_aliquota || 0}
                                  onChange={(e) => updateProduct(index, 'icms_aliquota', parseFloat(e.target.value) || 0)}
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">IPI CST</Label>
                                <Input
                                  value={produto.ipi_situacao_tributaria || ""}
                                  onChange={(e) => updateProduct(index, 'ipi_situacao_tributaria', e.target.value)}
                                  placeholder="99"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">PIS/COFINS CST</Label>
                                <Input
                                  value={produto.pis_situacao_tributaria || ""}
                                  onChange={(e) => {
                                    updateProduct(index, 'pis_situacao_tributaria', e.target.value);
                                    updateProduct(index, 'cofins_situacao_tributaria', e.target.value);
                                  }}
                                  placeholder="99"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
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
        </TabsContent>

        {/* Other Tab */}
        <TabsContent value="outros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transport</CardTitle>
              <CardDescription>Shipping information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Freight Mode *</Label>
                <Select
                  value={transporte.modalidade_frete}
                  onValueChange={(value) => setTransporte({ ...transporte, modalidade_frete: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Issuer</SelectItem>
                    <SelectItem value="1">1 - Customer</SelectItem>
                    <SelectItem value="2">2 - Third Party</SelectItem>
                    <SelectItem value="9">9 - No Freight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {transporte.modalidade_frete !== "9" && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Carrier CPF/CNPJ</Label>
                      <Input
                        value={transporte.transportadora.cpf_cnpj}
                        onChange={(e) => setTransporte({
                          ...transporte,
                          transportadora: { ...transporte.transportadora, cpf_cnpj: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label>Carrier Name</Label>
                      <Input
                        value={transporte.transportadora.razao_social}
                        onChange={(e) => setTransporte({
                          ...transporte,
                          transportadora: { ...transporte.transportadora, razao_social: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label>Carrier IE</Label>
                      <Input
                        value={transporte.transportadora.inscricao_estadual}
                        onChange={(e) => setTransporte({
                          ...transporte,
                          transportadora: { ...transporte.transportadora, inscricao_estadual: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Vehicle Plate</Label>
                      <Input
                        value={transporte.veiculo.placa}
                        onChange={(e) => setTransporte({
                          ...transporte,
                          veiculo: { ...transporte.veiculo, placa: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label>Vehicle UF</Label>
                      <Input
                        value={transporte.veiculo.uf}
                        onChange={(e) => setTransporte({
                          ...transporte,
                          veiculo: { ...transporte.veiculo, uf: e.target.value.toUpperCase() }
                        })}
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label>RNTC</Label>
                      <Input
                        value={transporte.veiculo.rntc}
                        onChange={(e) => setTransporte({
                          ...transporte,
                          veiculo: { ...transporte.veiculo, rntc: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
              <CardDescription>Payment information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Indicator *</Label>
                  <Select
                    value={pagamento.formas_pagamento[0].indicador_pagamento}
                    onValueChange={(value) => setPagamento({
                      formas_pagamento: [{
                        ...pagamento.formas_pagamento[0],
                        indicador_pagamento: value
                      }]
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - Cash Payment</SelectItem>
                      <SelectItem value="1">1 - Credit Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Method *</Label>
                  <Select
                    value={pagamento.formas_pagamento[0].meio_pagamento}
                    onValueChange={(value) => setPagamento({
                      formas_pagamento: [{
                        ...pagamento.formas_pagamento[0],
                        meio_pagamento: value
                      }]
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">01 - Cash</SelectItem>
                      <SelectItem value="02">02 - Check</SelectItem>
                      <SelectItem value="03">03 - Credit Card</SelectItem>
                      <SelectItem value="04">04 - Debit Card</SelectItem>
                      <SelectItem value="05">05 - Store Credit</SelectItem>
                      <SelectItem value="10">10 - Food Voucher</SelectItem>
                      <SelectItem value="11">11 - Meal Voucher</SelectItem>
                      <SelectItem value="12">12 - Gift Voucher</SelectItem>
                      <SelectItem value="13">13 - Fuel Voucher</SelectItem>
                      <SelectItem value="15">15 - Bank Transfer</SelectItem>
                      <SelectItem value="90">90 - No Payment</SelectItem>
                      <SelectItem value="99">99 - Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Payment Amount:</span>
                  <span className="text-xl font-bold text-primary">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(calculateTotal())}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Amount is automatically calculated from products total
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit Actions */}
      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button type="button" variant="outline" onClick={() => router.push("/")} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading} size="lg">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Issue NF-e
        </Button>
      </div>
    </form>
  );
}
