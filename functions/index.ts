import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from 'firebase-admin';
import axios from 'axios';

admin.initializeApp();
const db = admin.firestore();

const NUVEM_BASE_URL = "https://api.sandbox.nuvemfiscal.com.br/";
const NUVEM_AUTH_URL = "https://auth.nuvemfiscal.com.br/oauth/token"; // Auth URL has no 'sandbox' subdomain
const CLIENT_ID = process.env.CLIENT_ID || "";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "";

// Helper function to get OAuth access token
async function getNuvemFiscalToken(): Promise<string> {
    console.log('CLIENT_ID:', CLIENT_ID ? 'Set' : 'NOT SET');
    console.log('CLIENT_SECRET:', CLIENT_SECRET ? 'Set' : 'NOT SET');

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "nfe nfce nfse cte mdfe"
    });

    try {
        const response = await axios.post(
            NUVEM_AUTH_URL,
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('OAuth token obtained successfully');
        return response.data.access_token;
    } catch (error: any) {
        console.error('OAuth token error:', error.response?.data || error.message);
        throw new HttpsError('internal', `Failed to get OAuth token: ${error.message}`);
    }
}

// Issue NF-e
export const issueNFe_sandbox = onCall(async (request) => {
    try {
        console.log('=== issueNFe_sandbox called ===');

        if (!request.auth) {
            console.error('No authentication provided');
            throw new HttpsError("unauthenticated", "Authentication required");
        }

        const data = request.data;
        const uid = request.auth.uid;
        console.log('User ID:', uid);

        // Validate required fields
        if (!data?.emittente?.cpf_cnpj || !data?.destinatario || !data?.produtos) {
            console.error('Missing required fields');
            throw new HttpsError("invalid-argument", "Missing required fields");
        }

        // Get OAuth access token
        console.log('Getting OAuth token from NuvemFiscal...');
        const nuvemToken = await getNuvemFiscalToken();
        console.log('Token obtained, calling NuvemFiscal API...');

        // Calculate totals
        const totalProdutos = data.produtos.reduce((sum: number, p: any) => sum + p.valor_total, 0);

        // Map form data to NuvemFiscal API format
        const nfePayload = {
            ambiente: data.nfeConfig?.ambiente || "homologacao",
            referencia: `nfe_${Date.now()}`,

            infNFe: {
                versao: "4.00",

                // Identification
                ide: {
                    cUF: 35, // Código UF (simplified - should map from UF string)
                    cNF: String(Math.floor(Math.random() * 99999999)).padStart(8, '0'), // Código numérico
                    natOp: data.nfeConfig?.natureza_operacao || "VENDA",
                    mod: 55, // Model 55 = NF-e
                    serie: 1,
                    nNF: Math.floor(Math.random() * 999999) + 1,
                    dhEmi: new Date().toISOString(),
                    tpNF: parseInt(data.nfeConfig?.tipo_documento || "1"),
                    idDest: 1, // 1=Interna, 2=Interestadual, 3=Exterior
                    cMunFG: data.emittente.endereco.codigo_municipio,
                    tpImp: 1, // 1=Retrato
                    tpEmis: 1, // 1=Normal
                    cDV: 0, // Check digit (will be calculated by SEFAZ)
                    tpAmb: data.nfeConfig?.ambiente === "producao" ? 1 : 2,
                    finNFe: parseInt(data.nfeConfig?.finalidade_emissao || "1"),
                    indFinal: parseInt(data.nfeConfig?.consumidor_final || "1"),
                    indPres: parseInt(data.nfeConfig?.presenca_comprador || "1"),
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
                        fone: data.emittente.endereco.telefone?.replace(/[^\d]/g, '') || undefined
                    },
                    IE: data.emittente.inscricao_estadual && data.emittente.inscricao_estadual.trim() !== ""
                        ? data.emittente.inscricao_estadual.replace(/[^\d]/g, '')
                        : undefined,
                    CRT: parseInt(data.emittente.regime_tributario || "1")
                },

                // Destinatário
                dest: {
                    ...(data.destinatario.cpf_cnpj.replace(/[^\d]/g, '').length === 11
                        ? { CPF: data.destinatario.cpf_cnpj.replace(/[^\d]/g, '') }
                        : { CNPJ: data.destinatario.cpf_cnpj.replace(/[^\d]/g, '') }
                    ),
                    xNome: data.destinatario.razao_social,
                    enderDest: {
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
                        fone: data.destinatario.telefone?.replace(/[^\d]/g, '') || undefined
                    },
                    indIEDest: parseInt(data.destinatario.indicador_ie || "9"),
                    IE: data.destinatario.inscricao_estadual && data.destinatario.inscricao_estadual.trim() !== ""
                        ? data.destinatario.inscricao_estadual.replace(/[^\d]/g, '')
                        : undefined,
                    email: data.destinatario.email || undefined
                },

                // Items/Products
                det: data.produtos.map((item: any) => {
                    const icmsConfig = item.icms_situacao_tributaria.startsWith("1")
                        ? { // Simples Nacional
                            ICMSSN102: {
                                orig: parseInt(item.origem || "0"),
                                CSOSN: item.icms_situacao_tributaria
                            }
                        }
                        : { // Regime Normal
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
                    modFrete: parseInt(data.transporte?.modalidade_frete || "9")
                },

                // Payment
                pag: {
                    detPag: data.pagamento?.formas_pagamento?.map((fp: any) => ({
                        indPag: parseInt(fp.indicador_pagamento || "0"),
                        tPag: fp.meio_pagamento,
                        vPag: fp.valor || totalProdutos
                    })) || [{
                        indPag: 0,
                        tPag: "01",
                        vPag: totalProdutos
                    }]
                }
            }
        };

        console.log('Payload being sent to NuvemFiscal:', JSON.stringify(nfePayload, null, 2));

        const result = await axios.post(
            `${NUVEM_BASE_URL}nfe`,
            nfePayload,
            {
                headers: {
                    'Authorization': `Bearer ${nuvemToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('NuvemFiscal response:', result.data);

        // Save to Firestore
        const invoiceRef = db.collection("invoices").doc();
        const totalValue = data.produtos.reduce((sum: number, p: any) => sum + p.valor_total, 0);

        await invoiceRef.set({
            user_id: uid,
            nfe_id: result.data.id,
            invoice_type: "nfe", // Changed from 'type' to 'invoice_type' to match dashboard
            status: result.data.status || "processing",
            numero: result.data.numero || "Processando...",
            emittente: data.emittente,
            destinatario: data.destinatario,
            customer_name: data.destinatario?.nome || data.destinatario?.razao_social || null,
            produtos: data.produtos,
            valor_total: totalValue,
            total_value: totalValue, // Add alias for compatibility
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            raw_response: result.data // Store full API response for reference
        });

        return {
            success: true,
            invoice_id: invoiceRef.id,
            nfe_id: result.data.id,
            data: result.data
        };

    } catch (error: any) {
        console.error('NF-e creation error:', {
            message: error.message,
            response: error.response?.data,
            errors: JSON.stringify(error.response?.data?.error?.errors, null, 2),
            status: error.response?.status
        });
        throw new HttpsError(
            'internal',
            'Failed to issue NF-e',
            error.response?.data || error.message
        );
    }
});

// Query invoice status
export const queryInvoice_sandbox = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Authentication required");
        }

        const { invoice_id } = request.data;

        if (!invoice_id) {
            throw new HttpsError("invalid-argument", "invoice_id required");
        }

        const invoiceDoc = await db.collection("invoices").doc(invoice_id).get();

        if (!invoiceDoc.exists) {
            throw new HttpsError("not-found", "Invoice not found");
        }

        const invoiceData = invoiceDoc.data();
        const nfeId = invoiceData?.nfe_id;

        // Get OAuth access token
        const nuvemToken = await getNuvemFiscalToken();

        // Query NuvemFiscal
        const response = await axios.get(
            `${NUVEM_BASE_URL}nfe/${nfeId}`,
            {
                headers: {
                    'Authorization': `Bearer ${nuvemToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Update status in Firestore
        await db.collection("invoices").doc(invoice_id).update({
            status: response.data.status,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            status: response.data.status,
            data: response.data
        };

    } catch (error: any) {
        console.error('Query error:', error.response?.data || error.message);
        throw new HttpsError(
            'internal',
            'Failed to query invoice',
            error.response?.data || error.message
        );
    }
});

// Cancel invoice
export const cancelInvoice_sandbox = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Authentication required");
        }

        const { invoice_id, justificativa } = request.data;

        if (!invoice_id || !justificativa) {
            throw new HttpsError("invalid-argument", "invoice_id and justificativa required");
        }

        if (justificativa.length < 15) {
            throw new HttpsError("invalid-argument", "Justification must be at least 15 characters");
        }

        const invoiceDoc = await db.collection("invoices").doc(invoice_id).get();

        if (!invoiceDoc.exists) {
            throw new HttpsError("not-found", "Invoice not found");
        }

        const invoiceData = invoiceDoc.data();
        const nfeId = invoiceData?.nfe_id;

        // Get OAuth access token
        const nuvemToken = await getNuvemFiscalToken();

        // First, query the current status from NuvemFiscal to confirm
        try {
            const statusCheck = await axios.get(
                `${NUVEM_BASE_URL}nfe/${nfeId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${nuvemToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

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
        } catch (checkError: any) {
            if (checkError instanceof HttpsError) {
                throw checkError;
            }
            console.error('Error checking NF-e status:', checkError.response?.data);
        }

        // Cancel in NuvemFiscal
        const response = await axios.post(
            `${NUVEM_BASE_URL}nfe/${nfeId}/cancelamento`,
            { justificativa },
            {
                headers: {
                    'Authorization': `Bearer ${nuvemToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Update in Firestore
        await db.collection("invoices").doc(invoice_id).update({
            status: "cancelled",
            cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
            cancellation_reason: justificativa
        });

        return {
            success: true,
            data: response.data
        };

    } catch (error: any) {
        console.error('Cancellation error:', error.response?.data || error.message);
        throw new HttpsError(
            'internal',
            'Failed to cancel invoice',
            error.response?.data || error.message
        );
    }
});
