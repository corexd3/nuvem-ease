/**
 * Mock data for testing NF-e in NuvemFiscal homologação (sandbox) environment
 * All data is fictitious and valid for testing purposes only
 * Updated to match the comprehensive NF-e form structure
 *
 * NOTE: For MEI/Simples Nacional companies (CRT = 1):
 * - IE (inscricao_estadual) can be left empty if the company doesn't have one
 * - Or use "ISENTO" for exempt companies
 * - Only include a valid IE number if required by your state
 */

export const mockNFeConfig = {
  natureza_operacao: "VENDA",
  tipo_documento: "1", // Saída
  finalidade_emissao: "1", // Normal
  consumidor_final: "1", // Final Consumer
  presenca_comprador: "1", // In Person
  ambiente: "homologacao" as "homologacao" | "producao"
};

export const mockEmittente = {
  cpf_cnpj: "28.084.062/0001-48",
  inscricao_estadual: "90818021-62",
  razao_social: "HENRIQUE LUIS DE SOUZA",
  nome_fantasia: "Kip Tecnologia",
  regime_tributario: "1", // Simples Nacional
  endereco: {
    logradouro: "HEITOR STOCKLER DE FRANCA",
    numero: "396",
    complemento: "",
    bairro: "CENTRO CIVICO",
    codigo_municipio: "4106902", // Curitiba/PR
    cidade: "CURITIBA",
    uf: "PR",
    cep: "80030-030",
    codigo_pais: "1058",
    pais: "Brasil",
    telefone: ""
  }
};

export const mockDestinatario = {
  cpf_cnpj: "123.456.789-09", // Valid test CPF format
  razao_social: "João da Silva Santos",
  indicador_ie: "9", // Non-Contributor
  inscricao_estadual: "",
  email: "joao.silva@example.com",
  telefone: "11987654321",
  endereco: {
    logradouro: "Avenida Paulista",
    numero: "1000",
    complemento: "Apto 501",
    bairro: "Bela Vista",
    codigo_municipio: "3550308", // São Paulo/SP
    cidade: "São Paulo",
    uf: "SP",
    cep: "01310-200",
    codigo_pais: "1058",
    pais: "Brasil"
  }
};

export const mockProdutos = [
  {
    nItem: 1,
    codigo: "PROD001",
    descricao: "Produto Teste A - Eletrônicos",
    ncm: "85171231", // Valid NCM for electronic equipment
    cfop: "5102", // Sale of goods acquired/received from third parties
    unidade: "UN",
    quantidade: 2,
    valor_unitario: 150.00,
    valor_total: 300.00,
    cest: "2100300",
    cean: "7891234567890",
    origem: "0", // Nacional
    icms_situacao_tributaria: "102", // Simples Nacional - sem permissão de crédito
    icms_aliquota: 0,
    ipi_situacao_tributaria: "99", // Outras saídas
    pis_situacao_tributaria: "07", // 07 = Operação Isenta da Contribuição
    cofins_situacao_tributaria: "07" // 07 = Operação Isenta da Contribuição
  },
  {
    nItem: 2,
    codigo: "PROD002",
    descricao: "Produto Teste B - Acessórios",
    ncm: "84733090", // Valid NCM for accessories
    cfop: "5102",
    unidade: "UN",
    quantidade: 5,
    valor_unitario: 50.00,
    valor_total: 250.00,
    cest: "",
    cean: "",
    origem: "0", // Nacional
    icms_situacao_tributaria: "102",
    icms_aliquota: 0,
    ipi_situacao_tributaria: "99",
    pis_situacao_tributaria: "07",
    cofins_situacao_tributaria: "07"
  },
  {
    nItem: 3,
    codigo: "PROD003",
    descricao: "Produto Teste C - Serviços",
    ncm: "39269090",
    cfop: "5102",
    unidade: "UN",
    quantidade: 1,
    valor_unitario: 100.00,
    valor_total: 100.00,
    cest: "",
    cean: "",
    origem: "0",
    icms_situacao_tributaria: "102",
    icms_aliquota: 0,
    ipi_situacao_tributaria: "99",
    pis_situacao_tributaria: "99",
    cofins_situacao_tributaria: "99"
  }
];

export const mockTransporte = {
  modalidade_frete: "9", // Sem frete
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
};

export const mockPagamento = {
  formas_pagamento: [{
    indicador_pagamento: "0", // Pagamento à vista
    meio_pagamento: "01", // Dinheiro
    valor: 650.00 // Total from products
  }]
};

/**
 * Returns complete mock NF-e data ready for testing
 */
export function getMockNFeData() {
  return {
    nfeConfig: mockNFeConfig,
    emittente: mockEmittente,
    destinatario: mockDestinatario,
    produtos: mockProdutos,
    transporte: mockTransporte,
    pagamento: mockPagamento
  };
}
