"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { NFeService, EmpresaService, type EmittenteData } from '@/services/nuvemfiscal';
import { formatCNPJ, formatCEP, formatPhoneNumber, cleanNumberString } from '@/lib/utils';

interface Product {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  cst_icms?: string;
  csosn?: string;
  aliquota_icms?: number;
}

interface PaymentInfo {
  forma_pagamento: string;
  valor: number;
}

type EmittenteField = keyof EmittenteData | `endereco.${keyof EmittenteData['endereco']}`;

const PAYMENT_METHODS = [
  { value: '01', label: 'Dinheiro' },
  { value: '02', label: 'Cheque' },
  { value: '03', label: 'Cartão de Crédito' },
  { value: '04', label: 'Cartão de Débito' },
  { value: '05', label: 'Crédito Loja' },
  { value: '10', label: 'Vale Alimentação' },
  { value: '11', label: 'Vale Refeição' },
  { value: '12', label: 'Vale Presente' },
  { value: '13', label: 'Vale Combustível' },
  { value: '15', label: 'Boleto Bancário' },
  { value: '16', label: 'Depósito Bancário' },
  { value: '17', label: 'PIX' },
  { value: '99', label: 'Outros' }
] as const;

export function NFEForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('emittente');
  
  // Emittente State
  const [emittente, setEmittente] = useState<EmittenteData>({
    cpf_cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    inscricao_estadual: '',
    endereco: {
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: ''
    },
    telefone: '',
    email: ''
  });

  // Product State
  const [product, setProduct] = useState<Product>({
    codigo: '',
    descricao: '',
    ncm: '',
    cfop: '',
    unidade: '',
    quantidade: 1,
    valor_unitario: 0,
    cst_icms: '',
    csosn: '',
    aliquota_icms: 0
  });

  // Payment State
  const [payment, setPayment] = useState<PaymentInfo>({
    forma_pagamento: '01',
    valor: 0
  });

  // Load emittente data if available
  useEffect(() => {
    const loadEmittente = async () => {
      try {
        const response = await EmpresaService.getEmittente('current');
        if (response) {
          setEmittente(response);
        }
      } catch (error) {
        // Ignore error - new emittente will be created
      }
    };
    loadEmittente();
  }, []);

  const handleEmittenteChange = (field: EmittenteField, value: string) => {
    setEmittente(prev => {
      if (field.includes('.')) {
        const [_, child] = field.split('.');
        return {
          ...prev,
          endereco: {
            ...prev.endereco,
            [child]: value
          }
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleProductChange = (field: keyof Product, value: string | number) => {
    setProduct(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePaymentChange = (field: keyof PaymentInfo, value: string | number) => {
    setPayment(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First save/update emittente
      await EmpresaService.createEmittente(emittente);

      // Then create NFe
      const nfeData = {
        ambiente: process.env.NEXT_PUBLIC_NUVEMFISCAL_ENVIRONMENT || 'homologacao',
        emittente: {
          cpf_cnpj: cleanNumberString(emittente.cpf_cnpj),
          inscricao_estadual: emittente.inscricao_estadual
        },
        produtos: [
          {
            ...product,
            valor_total: product.quantidade * product.valor_unitario
          }
        ],
        pagamento: {
          formas_pagamento: [payment]
        }
      };

      await NFeService.createNFe(nfeData);
      
      toast({
        title: "Success",
        description: "NF-e created successfully",
      });

      // Move to next tab if not on last tab
      if (activeTab === 'emittente') setActiveTab('product');
      else if (activeTab === 'product') setActiveTab('payment');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="emittente">Emitente</TabsTrigger>
            <TabsTrigger value="product">Produto</TabsTrigger>
            <TabsTrigger value="payment">Pagamento</TabsTrigger>
          </TabsList>

          <TabsContent value="emittente">
            <form onSubmit={(e) => { e.preventDefault(); setActiveTab('product'); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf_cnpj">CNPJ</Label>
                  <Input
                    id="cpf_cnpj"
                    value={emittente.cpf_cnpj}
                    onChange={(e) => handleEmittenteChange('cpf_cnpj', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                  <Input
                    id="inscricao_estadual"
                    value={emittente.inscricao_estadual}
                    onChange={(e) => handleEmittenteChange('inscricao_estadual', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="razao_social">Razão Social</Label>
                  <Input
                    id="razao_social"
                    value={emittente.razao_social}
                    onChange={(e) => handleEmittenteChange('razao_social', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                  <Input
                    id="nome_fantasia"
                    value={emittente.nome_fantasia}
                    onChange={(e) => handleEmittenteChange('nome_fantasia', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco.cep">CEP</Label>
                  <Input
                    id="endereco.cep"
                    value={emittente.endereco.cep}
                    onChange={(e) => handleEmittenteChange('endereco.cep', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco.logradouro">Logradouro</Label>
                  <Input
                    id="endereco.logradouro"
                    value={emittente.endereco.logradouro}
                    onChange={(e) => handleEmittenteChange('endereco.logradouro', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco.numero">Número</Label>
                  <Input
                    id="endereco.numero"
                    value={emittente.endereco.numero}
                    onChange={(e) => handleEmittenteChange('endereco.numero', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco.bairro">Bairro</Label>
                  <Input
                    id="endereco.bairro"
                    value={emittente.endereco.bairro}
                    onChange={(e) => handleEmittenteChange('endereco.bairro', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco.cidade">Cidade</Label>
                  <Input
                    id="endereco.cidade"
                    value={emittente.endereco.cidade}
                    onChange={(e) => handleEmittenteChange('endereco.cidade', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco.uf">UF</Label>
                  <Input
                    id="endereco.uf"
                    value={emittente.endereco.uf}
                    onChange={(e) => handleEmittenteChange('endereco.uf', e.target.value)}
                    required
                    maxLength={2}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">Next</Button>
            </form>
          </TabsContent>

          <TabsContent value="product">
            <form onSubmit={(e) => { e.preventDefault(); setActiveTab('payment'); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código</Label>
                  <Input
                    id="codigo"
                    value={product.codigo}
                    onChange={(e) => handleProductChange('codigo', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input
                    id="descricao"
                    value={product.descricao}
                    onChange={(e) => handleProductChange('descricao', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ncm">NCM</Label>
                  <Input
                    id="ncm"
                    value={product.ncm}
                    onChange={(e) => handleProductChange('ncm', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfop">CFOP</Label>
                  <Input
                    id="cfop"
                    value={product.cfop}
                    onChange={(e) => handleProductChange('cfop', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unidade">Unidade</Label>
                  <Input
                    id="unidade"
                    value={product.unidade}
                    onChange={(e) => handleProductChange('unidade', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    value={product.quantidade}
                    onChange={(e) => handleProductChange('quantidade', parseFloat(e.target.value))}
                    required
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor_unitario">Valor Unitário</Label>
                  <Input
                    id="valor_unitario"
                    type="number"
                    value={product.valor_unitario}
                    onChange={(e) => handleProductChange('valor_unitario', parseFloat(e.target.value))}
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cst_icms">CST ICMS</Label>
                  <Input
                    id="cst_icms"
                    value={product.cst_icms}
                    onChange={(e) => handleProductChange('cst_icms', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aliquota_icms">Alíquota ICMS (%)</Label>
                  <Input
                    id="aliquota_icms"
                    type="number"
                    value={product.aliquota_icms}
                    onChange={(e) => handleProductChange('aliquota_icms', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => setActiveTab('emittente')}>
                  Back
                </Button>
                <Button type="submit" className="flex-1">Next</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="payment">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                  <Select
                    value={payment.forma_pagamento}
                    onValueChange={(value) => handlePaymentChange('forma_pagamento', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Formas de Pagamento</SelectLabel>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor</Label>
                  <Input
                    id="valor"
                    type="number"
                    value={payment.valor}
                    onChange={(e) => handlePaymentChange('valor', parseFloat(e.target.value))}
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => setActiveTab('product')}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Creating NF-e...' : 'Create NF-e'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}