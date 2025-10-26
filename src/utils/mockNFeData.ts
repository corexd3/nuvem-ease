/**
 * Mock data for testing NF-e in NuvemFiscal homologação (sandbox) environment
 * All data is fictitious and valid for testing purposes only
 */

export const mockEmittente = {
  cpf_cnpj: "11.222.333/0001-44", // Valid test CNPJ format
  inscricao_estadual: "123456789",
  razao_social: "EMPRESA TESTE LTDA",
  endereco: {
    logradouro: "Rua das Flores",
    numero: "100",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01310-100"
  }
};

export const mockDestinatario = {
  cpf_cnpj: "123.456.789-09", // Valid test CPF format
  razao_social: "João da Silva Santos",
  endereco: {
    logradouro: "Avenida Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01310-200"
  }
};

export const mockProdutos = [
  {
    codigo: "PROD001",
    descricao: "Produto Teste A - Eletrônicos",
    ncm: "85171231", // Valid NCM for electronic equipment
    cfop: "5102", // Sale of goods acquired/received from third parties
    unidade: "UN",
    quantidade: 2,
    valor_unitario: 150.00,
    valor_total: 300.00
  },
  {
    codigo: "PROD002",
    descricao: "Produto Teste B - Acessórios",
    ncm: "84733090", // Valid NCM for accessories
    cfop: "5102",
    unidade: "UN",
    quantidade: 5,
    valor_unitario: 50.00,
    valor_total: 250.00
  }
];

/**
 * Returns complete mock NF-e data ready for testing
 */
export function getMockNFeData() {
  return {
    emittente: mockEmittente,
    destinatario: mockDestinatario,
    produtos: mockProdutos
  };
}
