import axios from 'axios';

const BASE_URL = 'https://api.nuvemfiscal.com.br/';

// API configuration
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_NUVEMFISCAL_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Types
export interface EmittenteData {
  cpf_cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  telefone?: string;
  email?: string;
}

export interface ProductData {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  valor_unitario: number;
  cst_icms?: string;
  csosn?: string;
  aliquota_icms?: number;
}

// NFe Services
export const NFeService = {
  // Create NFe
  async createNFe(data: any) {
    try {
      const response = await api.post('/nfe', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error creating NFe');
    }
  },

  // Get NFe status
  async getNFeStatus(id: string) {
    try {
      const response = await api.get(`/nfe/${id}/status`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error getting NFe status');
    }
  },

  // Cancel NFe
  async cancelNFe(id: string, justificativa: string) {
    try {
      const response = await api.post(`/nfe/${id}/cancelar`, { justificativa });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error canceling NFe');
    }
  },

  // List NFes
  async listNFes(params?: { 
    ambiente?: 'homologacao' | 'producao',
    status?: string,
    data_inicial?: string,
    data_final?: string 
  }) {
    try {
      const response = await api.get('/nfe', { params });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error listing NFes');
    }
  }
};

// Certificate management
export const CertificateService = {
  async uploadCertificate(certificateFile: File, password: string) {
    try {
      const formData = new FormData();
      formData.append('certificate', certificateFile);
      formData.append('password', password);
      
      const response = await api.post('/certificado', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error uploading certificate');
    }
  },

  async listCertificates() {
    try {
      const response = await api.get('/certificado');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error listing certificates');
    }
  }
};

// Empresa (Emittente) management
export const EmpresaService = {
  async createEmittente(data: EmittenteData) {
    try {
      const response = await api.post('/empresa', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error creating empresa');
    }
  },

  async getEmittente(id: string) {
    try {
      const response = await api.get(`/empresa/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error getting empresa');
    }
  }
};