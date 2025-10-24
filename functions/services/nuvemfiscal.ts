import axios from "axios";
import { emit } from "process";


interface emitente{
    cpf_cnpj: string,           // ← YOUR CNPJ
    inscricao_estadual: string,      // ← YOUR IE
    regime_tributario: string
}
interface itens{
    numero_item : number,
    codigo_produto : string,
    descricao : string,
    ncm : string,
    cfop : string,
    unidade_comercial : string,
    quantidade_comercial : string,
    valor_unitario_comercial : string,
    valor_bruto : string,
    icms : {
        origem : string,
        csosn : string
    }
}
interface  forma_pagamento{
    meio_pagamento: number,            // ← Payment method (01=Cash, 03=Credit, 17=PIX)
    valor: number                   // ← Amount paid
}

class NuvemFiscalService {
    private token_url = "https://api.nuvemfiscal.com.br/auth/token";
    private api = axios.create({
        baseURL: process.env.base_url,
        headers: {
            "Authorization": `Bearer ${process.env.api_key}`,
            "Content-type": "application/json"
        }
    });

    async createInvoice(data: any) {
        const nfceData = this.formatNFCePayload(data);
        const response = await this.api.post('/nfce', nfceData);
        return response.data;
    }

    async queryInvoice(chave: string) {
        const response = await this.api.get(`/nfce/${chave}`);
        return response.data;
    }

    async cancelInvoice(chave: string, motivo: string) {
        const response = await this.api.post(`/nfce/${chave}/cancelamento`, { motivo });
        return response.data;
    }

    private formatNFCePayload(data: any) {
        const emitente : emitente= data.emitente;
        const itens : itens[] = data.items;
        const forma_pagamento : forma_pagamento = data.forma_pagamento;
        const fixedField = {
            ambiente: "homologacao",          // Only change to "producao" when going live
            natureza_operacao: "VENDA",       // Fixed for sales
            tipo_operacao: 1,                 // Fixed for NFC-e
            finalidade_emissao: 1,            // Fixed for normal operation
            consumidor_final: 1,              // Fixed for NFC-e
            presenca_comprador: 1
        }
        const valor_produtos =  itens.reduce((sum, item) => sum + parseFloat(item.valor_bruto), 0);
        const valor_total = data.valor_total;
        const payload = {
            emitente,
            ...fixedField,
            itens,
            valor_produtos,
            valor_total,
            forma_pagamento
        };
        return payload;
    }

    async getAccessToken(){
        try {
            const params = new URLSearchParams({
                grant_type : "client_credentials",
                client_id : "",
                client_secret : "",
                scope : "nfce:write nfce:read"
            });

            const response = await axios.post(this.token_url, params);
            return response.data.access_token;
        } catch (error) {
            console.error("Error fetching access token:", error);
            throw error;
        }
    }
}

export const nuvemfiscalService = new NuvemFiscalService();