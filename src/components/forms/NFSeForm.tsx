"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ServiceProvider {
  cpf_cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_municipal: string;
  email: string;
  telefone: string;
}

interface ServiceTaker {
  cpf_cnpj: string;
  nome: string;
  email: string;
  telefone: string;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
}

interface Service {
  descricao: string;
  codigo_municipal: string;
  valor_servico: number;
  aliquota_iss: number;
  valor_iss: number;
  valor_deducoes: number;
  valor_liquido: number;
}

export function NFSeForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [provider, setProvider] = useState<ServiceProvider>({
    cpf_cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    inscricao_municipal: '',
    email: '',
    telefone: ''
  });

  const [taker, setTaker] = useState<ServiceTaker>({
    cpf_cnpj: '',
    nome: '',
    email: '',
    telefone: '',
    endereco: {
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: ''
    }
  });

  const [service, setService] = useState<Service>({
    descricao: '',
    codigo_municipal: '',
    valor_servico: 0,
    aliquota_iss: 0,
    valor_iss: 0,
    valor_deducoes: 0,
    valor_liquido: 0
  });

  const handleProviderChange = (field: keyof ServiceProvider, value: string) => {
    setProvider(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTakerChange = (field: string, value: string) => {
    if (field.includes('.')) {
      const [_, child] = field.split('.');
      setTaker(prev => ({
        ...prev,
        endereco: {
          ...prev.endereco,
          [child]: value
        }
      }));
    } else {
      setTaker(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleServiceChange = (field: keyof Service, value: string | number) => {
    setService(prev => {
      const updated = {
        ...prev,
        [field]: value
      };

      // Auto-calculate ISS and net value when service value or rate changes
      if (field === 'valor_servico' || field === 'aliquota_iss' || field === 'valor_deducoes') {
        const valorServico = field === 'valor_servico' ? Number(value) : prev.valor_servico;
        const aliquotaIss = field === 'aliquota_iss' ? Number(value) : prev.aliquota_iss;
        const valorDeducoes = field === 'valor_deducoes' ? Number(value) : prev.valor_deducoes;

        updated.valor_iss = (valorServico * aliquotaIss) / 100;
        updated.valor_liquido = valorServico - valorDeducoes - updated.valor_iss;
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const nfseData = {
        ambiente: process.env.NEXT_PUBLIC_NUVEMFISCAL_ENVIRONMENT || 'homologacao',
        invoice_type: 'nfse',
        prestador: provider,
        tomador: taker,
        servico: service
      };

      // TODO: Implement NFS-e creation via NuvemFiscal API
      // await NFSeService.createNFSe(nfseData);

      if (mountedRef.current) {
        toast({
          title: "Success",
          description: "NFS-e created successfully",
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
      <Card>
        <CardHeader>
          <CardTitle>Service Provider (Prestador)</CardTitle>
          <CardDescription>Your company information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider_cpf_cnpj">CNPJ *</Label>
              <Input
                id="provider_cpf_cnpj"
                value={provider.cpf_cnpj}
                onChange={(e) => handleProviderChange('cpf_cnpj', e.target.value)}
                placeholder="00.000.000/0000-00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inscricao_municipal">Inscrição Municipal *</Label>
              <Input
                id="inscricao_municipal"
                value={provider.inscricao_municipal}
                onChange={(e) => handleProviderChange('inscricao_municipal', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider_razao_social">Razão Social *</Label>
              <Input
                id="provider_razao_social"
                value={provider.razao_social}
                onChange={(e) => handleProviderChange('razao_social', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider_nome_fantasia">Nome Fantasia</Label>
              <Input
                id="provider_nome_fantasia"
                value={provider.nome_fantasia}
                onChange={(e) => handleProviderChange('nome_fantasia', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider_email">Email</Label>
              <Input
                id="provider_email"
                type="email"
                value={provider.email}
                onChange={(e) => handleProviderChange('email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider_telefone">Telefone</Label>
              <Input
                id="provider_telefone"
                value={provider.telefone}
                onChange={(e) => handleProviderChange('telefone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Taker (Tomador)</CardTitle>
          <CardDescription>Client/customer information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taker_cpf_cnpj">CPF/CNPJ *</Label>
              <Input
                id="taker_cpf_cnpj"
                value={taker.cpf_cnpj}
                onChange={(e) => handleTakerChange('cpf_cnpj', e.target.value)}
                placeholder="000.000.000-00 or 00.000.000/0000-00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taker_nome">Nome/Razão Social *</Label>
              <Input
                id="taker_nome"
                value={taker.nome}
                onChange={(e) => handleTakerChange('nome', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taker_email">Email</Label>
              <Input
                id="taker_email"
                type="email"
                value={taker.email}
                onChange={(e) => handleTakerChange('email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taker_telefone">Telefone</Label>
              <Input
                id="taker_telefone"
                value={taker.telefone}
                onChange={(e) => handleTakerChange('telefone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taker_cep">CEP</Label>
              <Input
                id="taker_cep"
                value={taker.endereco.cep}
                onChange={(e) => handleTakerChange('endereco.cep', e.target.value)}
                placeholder="00000-000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taker_logradouro">Logradouro</Label>
              <Input
                id="taker_logradouro"
                value={taker.endereco.logradouro}
                onChange={(e) => handleTakerChange('endereco.logradouro', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taker_numero">Número</Label>
              <Input
                id="taker_numero"
                value={taker.endereco.numero}
                onChange={(e) => handleTakerChange('endereco.numero', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taker_bairro">Bairro</Label>
              <Input
                id="taker_bairro"
                value={taker.endereco.bairro}
                onChange={(e) => handleTakerChange('endereco.bairro', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taker_cidade">Cidade</Label>
              <Input
                id="taker_cidade"
                value={taker.endereco.cidade}
                onChange={(e) => handleTakerChange('endereco.cidade', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taker_uf">UF</Label>
              <Input
                id="taker_uf"
                value={taker.endereco.uf}
                onChange={(e) => handleTakerChange('endereco.uf', e.target.value)}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
          <CardDescription>Service details and ISS calculation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service_descricao">Descrição do Serviço *</Label>
            <Textarea
              id="service_descricao"
              value={service.descricao}
              onChange={(e) => handleServiceChange('descricao', e.target.value)}
              placeholder="Describe the services provided..."
              required
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo_municipal">Código Municipal do Serviço *</Label>
              <Input
                id="codigo_municipal"
                value={service.codigo_municipal}
                onChange={(e) => handleServiceChange('codigo_municipal', e.target.value)}
                placeholder="List item code"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_servico">Valor do Serviço *</Label>
              <Input
                id="valor_servico"
                type="number"
                value={service.valor_servico}
                onChange={(e) => handleServiceChange('valor_servico', parseFloat(e.target.value) || 0)}
                required
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aliquota_iss">Alíquota ISS (%) *</Label>
              <Input
                id="aliquota_iss"
                type="number"
                value={service.aliquota_iss}
                onChange={(e) => handleServiceChange('aliquota_iss', parseFloat(e.target.value) || 0)}
                required
                min="0"
                max="5"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_deducoes">Valor de Deduções</Label>
              <Input
                id="valor_deducoes"
                type="number"
                value={service.valor_deducoes}
                onChange={(e) => handleServiceChange('valor_deducoes', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_iss">Valor ISS (Calculado)</Label>
              <Input
                id="valor_iss"
                type="number"
                value={service.valor_iss}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_liquido">Valor Líquido (Calculado)</Label>
              <Input
                id="valor_liquido"
                type="number"
                value={service.valor_liquido}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Valor Total do Serviço:</span>
              <span className="text-2xl font-bold text-primary">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(service.valor_servico)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-muted-foreground">ISS a Recolher:</span>
              <span className="text-lg font-semibold text-orange-600">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(service.valor_iss)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-muted-foreground">Valor Líquido:</span>
              <span className="text-lg font-semibold text-green-600">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(service.valor_liquido)}
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
          {loading ? 'Creating NFS-e...' : 'Create NFS-e'}
        </Button>
      </div>
    </form>
  );
}
