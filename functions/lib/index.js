"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelInvoice_sandbox = exports.queryInvoice_sandbox = exports.issueNFe_sandbox = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
firebase_admin_1.default.initializeApp();
const db = firebase_admin_1.default.firestore();
const NUVEM_BASE_URL = "https://api.sandbox.nuvemfiscal.com.br/";
const NUVEM_AUTH_URL = "https://auth.nuvemfiscal.com.br/oauth/token"; // Auth URL has no 'sandbox' subdomain
const CLIENT_ID = process.env.CLIENT_ID || "";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "";
// Helper function to get OAuth access token
async function getNuvemFiscalToken() {
    var _a;
    console.log('CLIENT_ID:', CLIENT_ID ? 'Set' : 'NOT SET');
    console.log('CLIENT_SECRET:', CLIENT_SECRET ? 'Set' : 'NOT SET');
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "nfe nfce nfse cte mdfe"
    });
    try {
        const response = await axios_1.default.post(NUVEM_AUTH_URL, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('OAuth token obtained successfully');
        return response.data.access_token;
    }
    catch (error) {
        console.error('OAuth token error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new https_1.HttpsError('internal', `Failed to get OAuth token: ${error.message}`);
    }
}
// Issue NF-e
exports.issueNFe_sandbox = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    try {
        console.log('=== issueNFe_sandbox called ===');
        if (!request.auth) {
            console.error('No authentication provided');
            throw new https_1.HttpsError("unauthenticated", "Authentication required");
        }
        const data = request.data;
        const uid = request.auth.uid;
        console.log('User ID:', uid);
        // Validate required fields
        if (!((_a = data === null || data === void 0 ? void 0 : data.emittente) === null || _a === void 0 ? void 0 : _a.cpf_cnpj) || !(data === null || data === void 0 ? void 0 : data.destinatario) || !(data === null || data === void 0 ? void 0 : data.produtos)) {
            console.error('Missing required fields');
            throw new https_1.HttpsError("invalid-argument", "Missing required fields");
        }
        // Get OAuth access token
        console.log('Getting OAuth token from NuvemFiscal...');
        const nuvemToken = await getNuvemFiscalToken();
        console.log('Token obtained, calling NuvemFiscal API...');
        // Calculate totals
        const totalProdutos = data.produtos.reduce((sum, p) => sum + p.valor_total, 0);
        // Map form data to NuvemFiscal API format
        const nfePayload = {
            ambiente: ((_b = data.nfeConfig) === null || _b === void 0 ? void 0 : _b.ambiente) || "homologacao",
            referencia: `nfe_${Date.now()}`,
            infNFe: {
                versao: "4.00",
                // Identification
                ide: {
                    cUF: 35, // Código UF (simplified - should map from UF string)
                    cNF: String(Math.floor(Math.random() * 99999999)).padStart(8, '0'), // Código numérico
                    natOp: ((_c = data.nfeConfig) === null || _c === void 0 ? void 0 : _c.natureza_operacao) || "VENDA",
                    mod: 55, // Model 55 = NF-e
                    serie: 1,
                    nNF: Math.floor(Math.random() * 999999) + 1,
                    dhEmi: new Date().toISOString(),
                    tpNF: parseInt(((_d = data.nfeConfig) === null || _d === void 0 ? void 0 : _d.tipo_documento) || "1"),
                    idDest: 1, // 1=Interna, 2=Interestadual, 3=Exterior
                    cMunFG: data.emittente.endereco.codigo_municipio,
                    tpImp: 1, // 1=Retrato
                    tpEmis: 1, // 1=Normal
                    cDV: 0, // Check digit (will be calculated by SEFAZ)
                    tpAmb: ((_e = data.nfeConfig) === null || _e === void 0 ? void 0 : _e.ambiente) === "producao" ? 1 : 2,
                    finNFe: parseInt(((_f = data.nfeConfig) === null || _f === void 0 ? void 0 : _f.finalidade_emissao) || "1"),
                    indFinal: parseInt(((_g = data.nfeConfig) === null || _g === void 0 ? void 0 : _g.consumidor_final) || "1"),
                    indPres: parseInt(((_h = data.nfeConfig) === null || _h === void 0 ? void 0 : _h.presenca_comprador) || "1"),
                    procEmi: 0, // 0=Emissão própria
                    verProc: "1.0.0"
                },
                // Emitente
                emit: {
                    CNPJ: data.emittente.cpf_cnpj.replace(/[^\d]/g, ''),
                    xNome: data.emittente.razao_social,
                    xFant: data.emittente.nome_fantasia || data.emittente.razao_social,
                    enderEmit: {
                        xLgr: data.emittente.endereco.logradouro,
                        nro: data.emittente.endereco.numero,
                        xCpl: data.emittente.endereco.complemento || undefined,
                        xBairro: data.emittente.endereco.bairro,
                        cMun: data.emittente.endereco.codigo_municipio,
                        xMun: data.emittente.endereco.cidade,
                        UF: data.emittente.endereco.uf,
                        CEP: data.emittente.endereco.cep.replace(/[^\d]/g, ''),
                        cPais: data.emittente.endereco.codigo_pais || "1058",
                        xPais: data.emittente.endereco.pais || "Brasil",
                        fone: ((_j = data.emittente.endereco.telefone) === null || _j === void 0 ? void 0 : _j.replace(/[^\d]/g, '')) || undefined
                    },
                    IE: data.emittente.inscricao_estadual,
                    CRT: parseInt(data.emittente.regime_tributario || "1")
                },
                // Destinatário
                dest: Object.assign(Object.assign({}, (data.destinatario.cpf_cnpj.replace(/[^\d]/g, '').length === 11
                    ? { CPF: data.destinatario.cpf_cnpj.replace(/[^\d]/g, '') }
                    : { CNPJ: data.destinatario.cpf_cnpj.replace(/[^\d]/g, '') })), { xNome: data.destinatario.razao_social, enderDest: {
                        xLgr: data.destinatario.endereco.logradouro,
                        nro: data.destinatario.endereco.numero,
                        xCpl: data.destinatario.endereco.complemento || undefined,
                        xBairro: data.destinatario.endereco.bairro,
                        cMun: data.destinatario.endereco.codigo_municipio,
                        xMun: data.destinatario.endereco.cidade,
                        UF: data.destinatario.endereco.uf,
                        CEP: data.destinatario.endereco.cep.replace(/[^\d]/g, ''),
                        cPais: data.destinatario.endereco.codigo_pais || "1058",
                        xPais: data.destinatario.endereco.pais || "Brasil",
                        fone: ((_k = data.destinatario.telefone) === null || _k === void 0 ? void 0 : _k.replace(/[^\d]/g, '')) || undefined
                    }, indIEDest: parseInt(data.destinatario.indicador_ie || "9"), IE: data.destinatario.inscricao_estadual || undefined, email: data.destinatario.email || undefined }),
                // Items/Products
                det: data.produtos.map((item) => {
                    const icmsConfig = item.icms_situacao_tributaria.startsWith("1")
                        ? {
                            ICMSSN102: {
                                orig: parseInt(item.origem || "0"),
                                CSOSN: item.icms_situacao_tributaria
                            }
                        }
                        : {
                            ICMS00: {
                                orig: parseInt(item.origem || "0"),
                                CST: item.icms_situacao_tributaria,
                                modBC: 0,
                                vBC: item.valor_total,
                                pICMS: item.icms_aliquota || 0,
                                vICMS: (item.valor_total * (item.icms_aliquota || 0)) / 100
                            }
                        };
                    return {
                        nItem: item.nItem,
                        prod: {
                            cProd: item.codigo,
                            cEAN: item.cean || "SEM GTIN",
                            xProd: item.descricao,
                            NCM: item.ncm.replace(/[^\d]/g, ''),
                            CEST: item.cest || undefined,
                            CFOP: item.cfop,
                            uCom: item.unidade,
                            qCom: parseFloat(item.quantidade),
                            vUnCom: parseFloat(item.valor_unitario.toFixed(10)),
                            vProd: parseFloat(item.valor_total.toFixed(2)),
                            cEANTrib: item.cean || "SEM GTIN",
                            uTrib: item.unidade,
                            qTrib: parseFloat(item.quantidade),
                            vUnTrib: parseFloat(item.valor_unitario.toFixed(10)),
                            indTot: 1
                            // vFrete, vSeg, vDesc, vOutro: omit if zero
                        },
                        imposto: {
                            vTotTrib: 0,
                            ICMS: icmsConfig,
                            PIS: {
                                PISNT: {
                                    CST: item.pis_situacao_tributaria &&
                                        ["04", "05", "06", "07", "08", "09"].includes(item.pis_situacao_tributaria)
                                        ? item.pis_situacao_tributaria
                                        : "07" // 07 = Operação Isenta da Contribuição
                                }
                            },
                            COFINS: {
                                COFINSNT: {
                                    CST: item.cofins_situacao_tributaria &&
                                        ["04", "05", "06", "07", "08", "09"].includes(item.cofins_situacao_tributaria)
                                        ? item.cofins_situacao_tributaria
                                        : "07" // 07 = Operação Isenta da Contribuição
                                }
                            }
                        }
                    };
                }),
                // Totals
                total: {
                    ICMSTot: {
                        vBC: 0,
                        vICMS: 0,
                        vICMSDeson: 0,
                        vFCPUFDest: 0,
                        vICMSUFDest: 0,
                        vICMSUFRemet: 0,
                        vFCP: 0,
                        vBCST: 0,
                        vST: 0,
                        vFCPST: 0,
                        vFCPSTRet: 0,
                        vProd: totalProdutos,
                        vFrete: 0,
                        vSeg: 0,
                        vDesc: 0,
                        vII: 0,
                        vIPI: 0,
                        vIPIDevol: 0,
                        vPIS: 0,
                        vCOFINS: 0,
                        vOutro: 0,
                        vNF: totalProdutos,
                        vTotTrib: 0
                    }
                },
                // Transport
                transp: {
                    modFrete: parseInt(((_l = data.transporte) === null || _l === void 0 ? void 0 : _l.modalidade_frete) || "9")
                },
                // Payment
                pag: {
                    detPag: ((_o = (_m = data.pagamento) === null || _m === void 0 ? void 0 : _m.formas_pagamento) === null || _o === void 0 ? void 0 : _o.map((fp) => ({
                        indPag: parseInt(fp.indicador_pagamento || "0"),
                        tPag: fp.meio_pagamento,
                        vPag: fp.valor || totalProdutos
                    }))) || [{
                            indPag: 0,
                            tPag: "01",
                            vPag: totalProdutos
                        }]
                }
            }
        };
        console.log('Payload being sent to NuvemFiscal:', JSON.stringify(nfePayload, null, 2));
        const result = await axios_1.default.post(`${NUVEM_BASE_URL}nfe`, nfePayload, {
            headers: {
                'Authorization': `Bearer ${nuvemToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('NuvemFiscal response:', result.data);
        // Save to Firestore
        const invoiceRef = db.collection("invoices").doc();
        const totalValue = data.produtos.reduce((sum, p) => sum + p.valor_total, 0);
        await invoiceRef.set({
            user_id: uid,
            nfe_id: result.data.id,
            invoice_type: "nfe", // Changed from 'type' to 'invoice_type' to match dashboard
            status: result.data.status || "processing",
            numero: result.data.numero || "Processando...",
            emittente: data.emittente,
            destinatario: data.destinatario,
            customer_name: ((_p = data.destinatario) === null || _p === void 0 ? void 0 : _p.nome) || ((_q = data.destinatario) === null || _q === void 0 ? void 0 : _q.razao_social) || null,
            produtos: data.produtos,
            valor_total: totalValue,
            total_value: totalValue, // Add alias for compatibility
            created_at: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
            raw_response: result.data // Store full API response for reference
        });
        return {
            success: true,
            invoice_id: invoiceRef.id,
            nfe_id: result.data.id,
            data: result.data
        };
    }
    catch (error) {
        console.error('NF-e creation error:', {
            message: error.message,
            response: (_r = error.response) === null || _r === void 0 ? void 0 : _r.data,
            errors: JSON.stringify((_u = (_t = (_s = error.response) === null || _s === void 0 ? void 0 : _s.data) === null || _t === void 0 ? void 0 : _t.error) === null || _u === void 0 ? void 0 : _u.errors, null, 2),
            status: (_v = error.response) === null || _v === void 0 ? void 0 : _v.status
        });
        throw new https_1.HttpsError('internal', 'Failed to issue NF-e', ((_w = error.response) === null || _w === void 0 ? void 0 : _w.data) || error.message);
    }
});
// Query invoice status
exports.queryInvoice_sandbox = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "Authentication required");
        }
        const { invoice_id } = request.data;
        if (!invoice_id) {
            throw new https_1.HttpsError("invalid-argument", "invoice_id required");
        }
        const invoiceDoc = await db.collection("invoices").doc(invoice_id).get();
        if (!invoiceDoc.exists) {
            throw new https_1.HttpsError("not-found", "Invoice not found");
        }
        const invoiceData = invoiceDoc.data();
        const nfeId = invoiceData === null || invoiceData === void 0 ? void 0 : invoiceData.nfe_id;
        // Get OAuth access token
        const nuvemToken = await getNuvemFiscalToken();
        // Query NuvemFiscal
        const response = await axios_1.default.get(`${NUVEM_BASE_URL}nfe/${nfeId}`, {
            headers: {
                'Authorization': `Bearer ${nuvemToken}`,
                'Content-Type': 'application/json'
            }
        });
        // Update status in Firestore
        await db.collection("invoices").doc(invoice_id).update({
            status: response.data.status,
            updated_at: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            status: response.data.status,
            data: response.data
        };
    }
    catch (error) {
        console.error('Query error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new https_1.HttpsError('internal', 'Failed to query invoice', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
    }
});
// Cancel invoice
exports.cancelInvoice_sandbox = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c;
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "Authentication required");
        }
        const { invoice_id, justificativa } = request.data;
        if (!invoice_id || !justificativa) {
            throw new https_1.HttpsError("invalid-argument", "invoice_id and justificativa required");
        }
        if (justificativa.length < 15) {
            throw new https_1.HttpsError("invalid-argument", "Justification must be at least 15 characters");
        }
        const invoiceDoc = await db.collection("invoices").doc(invoice_id).get();
        if (!invoiceDoc.exists) {
            throw new https_1.HttpsError("not-found", "Invoice not found");
        }
        const invoiceData = invoiceDoc.data();
        const nfeId = invoiceData === null || invoiceData === void 0 ? void 0 : invoiceData.nfe_id;
        // Get OAuth access token
        const nuvemToken = await getNuvemFiscalToken();
        // First, query the current status from NuvemFiscal to confirm
        try {
            const statusCheck = await axios_1.default.get(`${NUVEM_BASE_URL}nfe/${nfeId}`, {
                headers: {
                    'Authorization': `Bearer ${nuvemToken}`,
                    'Content-Type': 'application/json'
                }
            });
            const apiStatus = statusCheck.data.status;
            console.log('Current NF-e status from API:', apiStatus);
            if (apiStatus !== "autorizado" && apiStatus !== "authorized") {
                // Return error as data instead of throwing to avoid 500 error in console
                return {
                    success: false,
                    error: {
                        code: "INVALID_STATUS",
                        message: `Cannot cancel NF-e. Current status: ${apiStatus}. Only authorized NF-e can be cancelled. Please check the invoice status first.`,
                        currentStatus: apiStatus
                    }
                };
            }
        }
        catch (checkError) {
            if (checkError instanceof https_1.HttpsError) {
                throw checkError;
            }
            console.error('Error checking NF-e status:', (_a = checkError.response) === null || _a === void 0 ? void 0 : _a.data);
        }
        // Cancel in NuvemFiscal
        const response = await axios_1.default.post(`${NUVEM_BASE_URL}nfe/${nfeId}/cancelamento`, { justificativa }, {
            headers: {
                'Authorization': `Bearer ${nuvemToken}`,
                'Content-Type': 'application/json'
            }
        });
        // Update in Firestore
        await db.collection("invoices").doc(invoice_id).update({
            status: "cancelled",
            cancelled_at: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
            cancellation_reason: justificativa
        });
        return {
            success: true,
            data: response.data
        };
    }
    catch (error) {
        console.error('Cancellation error:', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
        throw new https_1.HttpsError('internal', 'Failed to cancel invoice', ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message);
    }
});
//# sourceMappingURL=index.js.map