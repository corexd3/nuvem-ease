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

interface FieldError {
  field: string;
  message: string;
  example?: string;
}

export function NFeFormSimple() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldError>>({});
  const [showValidation, setShowValidation] = useState(false);

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

  const FieldErrorMessage = ({ fieldName }: { fieldName: string }) => {
    if (!showValidation || !fieldErrors[fieldName]) return null;

    const error = fieldErrors[fieldName];
    return (
      <div className="mt-1 text-sm text-red-600 dark:text-red-400">
        <p>{error.message}</p>
        {error.example && (
          <p className="text-xs text-muted-foreground mt-0.5">{error.example}</p>
        )}
      </div>
    );
  };

  const validateCPF = (cpf: string): boolean => {
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return false;

    // Check for known invalid CPFs
    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    // Validate check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleaned.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleaned.charAt(10))) return false;

    return true;
  };

  const validateCNPJ = (cnpj: string): boolean => {
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) return false;

    // Check for known invalid CNPJs
    if (/^(\d)\1{13}$/.test(cleaned)) return false;

    // Validate first check digit
    let sum = 0;
    let weight = 2;
    for (let i = 11; i >= 0; i--) {
      sum += parseInt(cleaned.charAt(i)) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (digit !== parseInt(cleaned.charAt(12))) return false;

    // Validate second check digit
    sum = 0;
    weight = 2;
    for (let i = 12; i >= 0; i--) {
      sum += parseInt(cleaned.charAt(i)) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (digit !== parseInt(cleaned.charAt(13))) return false;

    return true;
  };

  const validateCPFCNPJ = (value: string): boolean => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 11) return validateCPF(cleaned);
    if (cleaned.length === 14) return validateCNPJ(cleaned);
    return false;
  };

  const validateNCM = (ncm: string): boolean => {
    const cleaned = ncm.replace(/\D/g, '');
    return cleaned.length === 8;
  };

  const validateCFOP = (cfop: string): boolean => {
    const cleaned = cfop.replace(/\D/g, '');
    if (cleaned.length !== 4) return false;

    // CFOP must start with 1-7 (valid operation types)
    const firstDigit = parseInt(cleaned.charAt(0));
    if (firstDigit < 1 || firstDigit > 7) return false;

    return true;
  };

  const validateCEP = (cep: string): boolean => {
    const cleaned = cep.replace(/\D/g, '');
    return cleaned.length === 8;
  };

  const validateIE = (ie: string, indicador: string): boolean => {
    // IE validation depends on the indicator (indIEDest)
    // 1 = Contributor (IE required, 2-14 digits)
    // 2 = Exempt (IE should be "ISENTO" or similar)
    // 9 = Non-contributor (IE should be empty/null)

    if (indicador === "9") {
      // Non-contributor: IE should be empty
      return !ie || ie.trim() === '';
    }

    if (indicador === "2") {
      // Exempt: IE can be empty or "ISENTO"
      if (!ie || ie.trim() === '') return true;
      return ie.toUpperCase() === 'ISENTO';
    }

    if (indicador === "1") {
      // Contributor: IE is required and must be 2-14 digits
      if (!ie || ie.trim() === '') return false; // Required!
      const cleaned = ie.replace(/\D/g, '');
      return cleaned.length >= 2 && cleaned.length <= 14;
    }

    // Default: allow empty or valid format
    if (!ie || ie.trim() === '') return true;
    const cleaned = ie.replace(/\D/g, '');
    return cleaned.length >= 2 && cleaned.length <= 14;
  };

  const validateEmail = (email: string): boolean => {
    // Email is optional, but if provided must be valid
    if (!email || email.trim() === '') return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // Phone is optional, but if provided must be 10-11 digits
    if (!phone || phone.trim() === '') return true; // Optional field
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
  };

  const validateForm = (): { valid: boolean; errors: string[]; fieldErrors: Record<string, FieldError> } => {
    const errors: string[] = [];
    const newFieldErrors: Record<string, FieldError> = {};

    // Validate Emittente (Issuer)
    if (!emittente.cpf_cnpj || !validateCPFCNPJ(emittente.cpf_cnpj)) {
      const msg = "CPF/CNPJ is required (11 or 14 digits)";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.cpf_cnpj'] = { field: 'emittente.cpf_cnpj', message: msg, example: 'Example: 12.345.678/0001-90' };
    }
    if (!emittente.razao_social || emittente.razao_social.trim().length < 3) {
      const msg = "Company name is required (minimum 3 characters)";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.razao_social'] = { field: 'emittente.razao_social', message: msg, example: 'Example: Empresa XYZ Ltda' };
    }
    // For issuer, IE is typically optional (can be empty for some tax regimes)
    if (emittente.inscricao_estadual && emittente.inscricao_estadual.trim() !== '') {
      const cleaned = emittente.inscricao_estadual.replace(/\D/g, '');
      if (cleaned.length < 2 || cleaned.length > 14) {
        const msg = "State registration (IE) must be 2-14 digits if provided";
        errors.push("Issuer " + msg);
        newFieldErrors['emittente.inscricao_estadual'] = { field: 'emittente.inscricao_estadual', message: msg, example: 'Example: 123456789' };
      }
    }
    if (!validatePhone(emittente.endereco.telefone)) {
      const msg = "Phone must be 10-11 digits (optional)";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.endereco.telefone'] = { field: 'emittente.endereco.telefone', message: msg, example: 'Example: (11) 98765-4321' };
    }
    if (!emittente.endereco.logradouro) {
      const msg = "Street address is required";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.endereco.logradouro'] = { field: 'emittente.endereco.logradouro', message: msg, example: 'Example: Rua das Flores' };
    }
    if (!emittente.endereco.numero) {
      const msg = "Address number is required";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.endereco.numero'] = { field: 'emittente.endereco.numero', message: msg, example: 'Example: 123' };
    }
    if (!emittente.endereco.bairro || emittente.endereco.bairro.trim().length < 2) {
      const msg = "Neighborhood is required (minimum 2 characters)";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.endereco.bairro'] = { field: 'emittente.endereco.bairro', message: msg, example: 'Example: Centro' };
    }
    if (!emittente.endereco.codigo_municipio || emittente.endereco.codigo_municipio.length !== 7) {
      const msg = "City code is required (7 digits)";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.endereco.codigo_municipio'] = { field: 'emittente.endereco.codigo_municipio', message: msg, example: 'Example: 3550308' };
    }
    if (!emittente.endereco.cidade) {
      const msg = "City is required";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.endereco.cidade'] = { field: 'emittente.endereco.cidade', message: msg, example: 'Example: São Paulo' };
    }
    if (!emittente.endereco.uf || emittente.endereco.uf.length !== 2) {
      const msg = "State (UF) is required (2 letters)";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.endereco.uf'] = { field: 'emittente.endereco.uf', message: msg, example: 'Example: SP' };
    }
    if (!emittente.endereco.cep || !validateCEP(emittente.endereco.cep)) {
      const msg = "CEP is required (8 digits)";
      errors.push("Issuer " + msg);
      newFieldErrors['emittente.endereco.cep'] = { field: 'emittente.endereco.cep', message: msg, example: 'Example: 01310-100' };
    }

    // Validate Destinatario (Customer)
    if (!destinatario.cpf_cnpj || !validateCPFCNPJ(destinatario.cpf_cnpj)) {
      const msg = "CPF/CNPJ is required (11 or 14 digits)";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.cpf_cnpj'] = { field: 'destinatario.cpf_cnpj', message: msg, example: 'Example: 123.456.789-00 or 12.345.678/0001-90' };
    }
    if (!destinatario.razao_social || destinatario.razao_social.trim().length < 3) {
      const msg = "Name is required (minimum 3 characters)";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.razao_social'] = { field: 'destinatario.razao_social', message: msg, example: 'Example: João Silva or Empresa ABC' };
    }
    // Validate IE based on indicator
    if (!validateIE(destinatario.inscricao_estadual, destinatario.indicador_ie)) {
      let msg = "";
      let example = "";

      if (destinatario.indicador_ie === "1") {
        msg = "State registration (IE) is required for contributors";
        example = "Example: 123456789 (2-14 digits)";
      } else if (destinatario.indicador_ie === "2") {
        msg = "For exempt taxpayers, IE should be empty or 'ISENTO'";
        example = "Example: ISENTO or leave empty";
      } else if (destinatario.indicador_ie === "9") {
        msg = "For non-contributors, IE must be empty";
        example = "Leave IE field empty";
      }

      errors.push("Customer " + msg);
      newFieldErrors['destinatario.inscricao_estadual'] = { field: 'destinatario.inscricao_estadual', message: msg, example };
    }
    if (!validateEmail(destinatario.email)) {
      const msg = "Email must be valid (optional)";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.email'] = { field: 'destinatario.email', message: msg, example: 'Example: cliente@empresa.com.br' };
    }
    if (!validatePhone(destinatario.telefone)) {
      const msg = "Phone must be 10-11 digits (optional)";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.telefone'] = { field: 'destinatario.telefone', message: msg, example: 'Example: (11) 98765-4321' };
    }
    if (!destinatario.endereco.logradouro) {
      const msg = "Street address is required";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.endereco.logradouro'] = { field: 'destinatario.endereco.logradouro', message: msg, example: 'Example: Avenida Paulista' };
    }
    if (!destinatario.endereco.numero) {
      const msg = "Address number is required";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.endereco.numero'] = { field: 'destinatario.endereco.numero', message: msg, example: 'Example: 1578' };
    }
    if (!destinatario.endereco.bairro || destinatario.endereco.bairro.trim().length < 2) {
      const msg = "Neighborhood is required (minimum 2 characters)";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.endereco.bairro'] = { field: 'destinatario.endereco.bairro', message: msg, example: 'Example: Bela Vista' };
    }
    if (!destinatario.endereco.codigo_municipio || destinatario.endereco.codigo_municipio.length !== 7) {
      const msg = "City code is required (7 digits)";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.endereco.codigo_municipio'] = { field: 'destinatario.endereco.codigo_municipio', message: msg, example: 'Example: 3550308' };
    }
    if (!destinatario.endereco.cidade) {
      const msg = "City is required";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.endereco.cidade'] = { field: 'destinatario.endereco.cidade', message: msg, example: 'Example: São Paulo' };
    }
    if (!destinatario.endereco.uf || destinatario.endereco.uf.length !== 2) {
      const msg = "State (UF) is required (2 letters)";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.endereco.uf'] = { field: 'destinatario.endereco.uf', message: msg, example: 'Example: SP' };
    }
    if (!destinatario.endereco.cep || !validateCEP(destinatario.endereco.cep)) {
      const msg = "CEP is required (8 digits)";
      errors.push("Customer " + msg);
      newFieldErrors['destinatario.endereco.cep'] = { field: 'destinatario.endereco.cep', message: msg, example: 'Example: 01310-100' };
    }

    // Validate Products
    if (produtos.length === 0) {
      errors.push("At least one product is required");
    }

    produtos.forEach((produto, index) => {
      const itemNum = index + 1;

      if (!produto.codigo || produto.codigo.trim().length === 0) {
        const msg = "Code is required";
        errors.push(`Product ${itemNum}: ${msg}`);
        newFieldErrors[`produtos.${index}.codigo`] = { field: `produtos.${index}.codigo`, message: msg, example: 'Example: PROD001' };
      }
      if (!produto.descricao || produto.descricao.trim().length < 3) {
        const msg = "Description is required (minimum 3 characters)";
        errors.push(`Product ${itemNum}: ${msg}`);
        newFieldErrors[`produtos.${index}.descricao`] = { field: `produtos.${index}.descricao`, message: msg, example: 'Example: Notebook Dell Inspiron' };
      }
      if (!produto.ncm || !validateNCM(produto.ncm)) {
        const msg = "NCM is required (8 digits)";
        errors.push(`Product ${itemNum}: ${msg}`);
        newFieldErrors[`produtos.${index}.ncm`] = { field: `produtos.${index}.ncm`, message: msg, example: 'Example: 85171231' };
      }
      if (!produto.cfop || !validateCFOP(produto.cfop)) {
        const msg = "CFOP is required (4 digits)";
        errors.push(`Product ${itemNum}: ${msg}`);
        newFieldErrors[`produtos.${index}.cfop`] = { field: `produtos.${index}.cfop`, message: msg, example: 'Example: 5102' };
      }
      if (!produto.unidade || produto.unidade.trim().length === 0) {
        const msg = "Unit is required";
        errors.push(`Product ${itemNum}: ${msg}`);
        newFieldErrors[`produtos.${index}.unidade`] = { field: `produtos.${index}.unidade`, message: msg, example: 'Example: UN, KG, M' };
      }
      if (produto.quantidade <= 0) {
        const msg = "Quantity must be greater than 0";
        errors.push(`Product ${itemNum}: ${msg}`);
        newFieldErrors[`produtos.${index}.quantidade`] = { field: `produtos.${index}.quantidade`, message: msg, example: 'Example: 1, 2.5, 10' };
      }
      if (produto.valor_unitario <= 0) {
        const msg = "Unit price must be greater than 0";
        errors.push(`Product ${itemNum}: ${msg}`);
        newFieldErrors[`produtos.${index}.valor_unitario`] = { field: `produtos.${index}.valor_unitario`, message: msg, example: 'Example: 150.00' };
      }
      if (produto.valor_total <= 0) {
        const msg = "Total value must be greater than 0";
        errors.push(`Product ${itemNum}: ${msg}`);
        newFieldErrors[`produtos.${index}.valor_total`] = { field: `produtos.${index}.valor_total`, message: msg, example: 'Example: 300.00' };
      }
    });

    // Validate total value
    const total = calculateTotal();
    if (total <= 0) {
      errors.push("Invoice total must be greater than 0");
    }

    return {
      valid: errors.length === 0,
      errors,
      fieldErrors: newFieldErrors
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    const validation = validateForm();
    if (!validation.valid) {
      // Set field errors to display inline
      setFieldErrors(validation.fieldErrors);
      setShowValidation(true);

      toast({
        title: "Validation Error",
        description: (
          <div className="space-y-1">
            <p className="font-semibold">Please fix the following errors:</p>
            <ul className="list-disc list-inside text-sm">
              {validation.errors.slice(0, 5).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
            {validation.errors.length > 5 && (
              <p className="text-sm italic">...and {validation.errors.length - 5} more error(s)</p>
            )}
          </div>
        ),
        variant: "destructive",
        duration: 8000,
      });
      setLoading(false);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});
    setShowValidation(false);
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
                    placeholder="12.345.678/0001-90"
                    required
                    className={showValidation && fieldErrors['emittente.cpf_cnpj'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.cpf_cnpj" />
                </div>
                <div>
                  <Label>State Registration (IE)</Label>
                  <Input
                    value={emittente.inscricao_estadual}
                    onChange={(e) => setEmittente({ ...emittente, inscricao_estadual: e.target.value })}
                    placeholder="90818021-62 (optional, 2-14 digits)"
                    className={showValidation && fieldErrors['emittente.inscricao_estadual'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.inscricao_estadual" />
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
                    placeholder="Empresa XYZ Ltda"
                    required
                    className={showValidation && fieldErrors['emittente.razao_social'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.razao_social" />
                </div>
                <div>
                  <Label>Trade Name</Label>
                  <Input
                    value={emittente.nome_fantasia}
                    onChange={(e) => setEmittente({ ...emittente, nome_fantasia: e.target.value })}
                    placeholder="XYZ Store"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label>Street *</Label>
                  <Input
                    value={emittente.endereco.logradouro}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, logradouro: e.target.value }})}
                    placeholder="Rua das Flores"
                    required
                    className={showValidation && fieldErrors['emittente.endereco.logradouro'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.endereco.logradouro" />
                </div>
                <div>
                  <Label>Number *</Label>
                  <Input
                    value={emittente.endereco.numero}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, numero: e.target.value }})}
                    placeholder="123"
                    required
                    className={showValidation && fieldErrors['emittente.endereco.numero'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.endereco.numero" />
                </div>
                <div>
                  <Label>Complement</Label>
                  <Input
                    value={emittente.endereco.complemento}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, complemento: e.target.value }})}
                    placeholder="Apt 101"
                  />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <Label>District *</Label>
                  <Input
                    value={emittente.endereco.bairro}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, bairro: e.target.value }})}
                    placeholder="Centro"
                    required
                    className={showValidation && fieldErrors['emittente.endereco.bairro'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.endereco.bairro" />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    value={emittente.endereco.cidade}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, cidade: e.target.value }})}
                    placeholder="São Paulo"
                    required
                    className={showValidation && fieldErrors['emittente.endereco.cidade'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.endereco.cidade" />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input
                    value={emittente.endereco.uf}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, uf: e.target.value.toUpperCase() }})}
                    maxLength={2}
                    placeholder="SP"
                    required
                    className={showValidation && fieldErrors['emittente.endereco.uf'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.endereco.uf" />
                </div>
                <div>
                  <Label>CEP *</Label>
                  <Input
                    value={emittente.endereco.cep}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, cep: e.target.value }})}
                    placeholder="01310-100"
                    required
                    className={showValidation && fieldErrors['emittente.endereco.cep'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.endereco.cep" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={emittente.endereco.telefone}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, telefone: e.target.value }})}
                    placeholder="(11) 98765-4321"
                    className={showValidation && fieldErrors['emittente.endereco.telefone'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.endereco.telefone" />
                </div>
                <div>
                  <Label>City Code *</Label>
                  <Input
                    value={emittente.endereco.codigo_municipio}
                    onChange={(e) => setEmittente({ ...emittente, endereco: { ...emittente.endereco, codigo_municipio: e.target.value }})}
                    placeholder="3550308"
                    required
                    className={showValidation && fieldErrors['emittente.endereco.codigo_municipio'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="emittente.endereco.codigo_municipio" />
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
                    placeholder="123.456.789-00"
                    required
                    className={showValidation && fieldErrors['destinatario.cpf_cnpj'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.cpf_cnpj" />
                </div>
                <div className="col-span-2">
                  <Label>Name *</Label>
                  <Input
                    value={destinatario.razao_social}
                    placeholder="João Silva"
                    className={showValidation && fieldErrors['destinatario.razao_social'] ? 'border-red-500' : ''}
                    onChange={(e) => setDestinatario({ ...destinatario, razao_social: e.target.value })}
                    required
                  />
                  <FieldErrorMessage fieldName="destinatario.razao_social" />
                </div>
                <div>
                  <Label>IE Indicator *</Label>
                  <Select
                    value={destinatario.indicador_ie}
                    onValueChange={(value) => {
                      // Clear IE field if changing to non-contributor
                      const newDestinatario = { ...destinatario, indicador_ie: value };
                      if (value === "9") {
                        newDestinatario.inscricao_estadual = "";
                      }
                      setDestinatario(newDestinatario);
                    }}
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
                  <Label>
                    State Registration (IE)
                    {destinatario.indicador_ie === "1" && <span className="text-red-500"> *</span>}
                  </Label>
                  <Input
                    value={destinatario.inscricao_estadual}
                    onChange={(e) => setDestinatario({ ...destinatario, inscricao_estadual: e.target.value })}
                    placeholder={
                      destinatario.indicador_ie === "1"
                        ? "123456789 (required, 2-14 digits)"
                        : destinatario.indicador_ie === "2"
                        ? "ISENTO or leave empty"
                        : "Leave empty for non-contributors"
                    }
                    disabled={destinatario.indicador_ie === "9"}
                    className={showValidation && fieldErrors['destinatario.inscricao_estadual'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.inscricao_estadual" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {destinatario.indicador_ie === "1" && "Required for taxpayers"}
                    {destinatario.indicador_ie === "2" && "Type 'ISENTO' or leave empty if exempt"}
                    {destinatario.indicador_ie === "9" && "Not applicable for non-contributors"}
                  </p>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={destinatario.email}
                    onChange={(e) => setDestinatario({ ...destinatario, email: e.target.value })}
                    placeholder="cliente@email.com"
                    className={showValidation && fieldErrors['destinatario.email'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.email" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={destinatario.telefone}
                    onChange={(e) => setDestinatario({ ...destinatario, telefone: e.target.value })}
                    placeholder="(11) 98765-4321"
                    className={showValidation && fieldErrors['destinatario.telefone'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.telefone" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label>Street *</Label>
                  <Input
                    value={destinatario.endereco.logradouro}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, logradouro: e.target.value }})}
                    placeholder="Avenida Paulista"
                    required
                    className={showValidation && fieldErrors['destinatario.endereco.logradouro'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.endereco.logradouro" />
                </div>
                <div>
                  <Label>Number *</Label>
                  <Input
                    value={destinatario.endereco.numero}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, numero: e.target.value }})}
                    placeholder="1578"
                    required
                    className={showValidation && fieldErrors['destinatario.endereco.numero'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.endereco.numero" />
                </div>
                <div>
                  <Label>Complement</Label>
                  <Input
                    value={destinatario.endereco.complemento}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, complemento: e.target.value }})}
                    placeholder="Apto 205"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>District *</Label>
                  <Input
                    value={destinatario.endereco.bairro}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, bairro: e.target.value }})}
                    placeholder="Bela Vista"
                    required
                    className={showValidation && fieldErrors['destinatario.endereco.bairro'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.endereco.bairro" />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    value={destinatario.endereco.cidade}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, cidade: e.target.value }})}
                    placeholder="São Paulo"
                    required
                    className={showValidation && fieldErrors['destinatario.endereco.cidade'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.endereco.cidade" />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input
                    value={destinatario.endereco.uf}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, uf: e.target.value.toUpperCase() }})}
                    maxLength={2}
                    placeholder="SP"
                    required
                    className={showValidation && fieldErrors['destinatario.endereco.uf'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.endereco.uf" />
                </div>
                <div>
                  <Label>CEP *</Label>
                  <Input
                    value={destinatario.endereco.cep}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, cep: e.target.value }})}
                    placeholder="01310-100"
                    required
                    className={showValidation && fieldErrors['destinatario.endereco.cep'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.endereco.cep" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City Code *</Label>
                  <Input
                    value={destinatario.endereco.codigo_municipio}
                    onChange={(e) => setDestinatario({ ...destinatario, endereco: { ...destinatario.endereco, codigo_municipio: e.target.value }})}
                    placeholder="3550308"
                    required
                    className={showValidation && fieldErrors['destinatario.endereco.codigo_municipio'] ? 'border-red-500' : ''}
                  />
                  <FieldErrorMessage fieldName="destinatario.endereco.codigo_municipio" />
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
                              placeholder="PROD001"
                              required
                              size={10}
                              className={showValidation && fieldErrors[`produtos.${index}.codigo`] ? 'border-red-500' : ''}
                            />
                            <FieldErrorMessage fieldName={`produtos.${index}.codigo`} />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Description *</Label>
                            <Input
                              value={produto.descricao}
                              onChange={(e) => updateProduct(index, 'descricao', e.target.value)}
                              placeholder="Notebook Dell Inspiron"
                              required
                              className={showValidation && fieldErrors[`produtos.${index}.descricao`] ? 'border-red-500' : ''}
                            />
                            <FieldErrorMessage fieldName={`produtos.${index}.descricao`} />
                          </div>
                          <div>
                            <Label className="text-xs">NCM *</Label>
                            <Input
                              value={produto.ncm}
                              onChange={(e) => updateProduct(index, 'ncm', e.target.value)}
                              placeholder="85171231"
                              required
                              className={showValidation && fieldErrors[`produtos.${index}.ncm`] ? 'border-red-500' : ''}
                            />
                            <FieldErrorMessage fieldName={`produtos.${index}.ncm`} />
                          </div>
                          <div>
                            <Label className="text-xs">CFOP *</Label>
                            <Input
                              value={produto.cfop}
                              onChange={(e) => updateProduct(index, 'cfop', e.target.value)}
                              placeholder="5102"
                              required
                              className={showValidation && fieldErrors[`produtos.${index}.cfop`] ? 'border-red-500' : ''}
                            />
                            <FieldErrorMessage fieldName={`produtos.${index}.cfop`} />
                          </div>
                          <div>
                            <Label className="text-xs">Unit *</Label>
                            <Input
                              value={produto.unidade}
                              onChange={(e) => updateProduct(index, 'unidade', e.target.value)}
                              placeholder="UN"
                              required
                              className={showValidation && fieldErrors[`produtos.${index}.unidade`] ? 'border-red-500' : ''}
                            />
                            <FieldErrorMessage fieldName={`produtos.${index}.unidade`} />
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
                              placeholder="1"
                              required
                              className={showValidation && fieldErrors[`produtos.${index}.quantidade`] ? 'border-red-500' : ''}
                            />
                            <FieldErrorMessage fieldName={`produtos.${index}.quantidade`} />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Price *</Label>
                            <Input
                              type="number"
                              value={produto.valor_unitario}
                              onChange={(e) => updateProduct(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              placeholder="150.00"
                              required
                              className={showValidation && fieldErrors[`produtos.${index}.valor_unitario`] ? 'border-red-500' : ''}
                            />
                            <FieldErrorMessage fieldName={`produtos.${index}.valor_unitario`} />
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
