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

                // Emitente - Build emit object with conditional IE
                emit: (() => {
                    const ie = data.emittente.inscricao_estadual?.trim();
                    const crt = parseInt(data.emittente.regime_tributario || "1");

                    // Build base emit object
                    const emitObj: any = {
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
                        }
                    };

                    // Add CRT first
                    emitObj.CRT = crt;

                    // Handle IE field based on CRT
                    // For CRT 1 (Simples Nacional): IE is REQUIRED - use "ISENTO" if not provided
                    // For CRT 2/3 (Normal Regime): IE can be omitted
                    if (ie && ie !== "") {
                        const ieUpper = ie.toUpperCase();

                        // Check if it's "ISENTO"
                        if (ieUpper === "ISENTO") {
                            emitObj.IE = "ISENTO";
                        } else {
                            // Clean and validate numeric IE
                            const cleanIE = ie.replace(/[^\d]/g, '');

                            // IE must be 2-14 digits for API validation
                            if (cleanIE.length >= 2 && cleanIE.length <= 14) {
                                emitObj.IE = cleanIE;
                            } else {
                                // Invalid IE - use ISENTO for Simples Nacional
                                console.warn(`Invalid IE "${ie}" (${cleanIE.length} digits). Using ISENTO for Simples Nacional.`);
                                if (crt === 1) {
                                    emitObj.IE = "ISENTO";
                                }
                            }
                        }
                    } else {
                        // No IE provided - for Simples Nacional, IE field is required, use "ISENTO"
                        if (crt === 1) {
                            console.log(`No IE provided for Simples Nacional. Using ISENTO.`);
                            emitObj.IE = "ISENTO";
                        }
                        // For CRT 2/3 (Normal Regime), omit IE field (don't add it)
                    }

                    return emitObj;
                })(),

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
                    IE: (() => {
                        const indicador = data.destinatario.indicador_ie;
                        const ie = data.destinatario.inscricao_estadual;

                        // If empty or null, return undefined (will be omitted)
                        if (!ie || ie.trim() === "") return undefined;

                        // For exempt (2), allow "ISENTO" string
                        if (indicador === "2" && ie.toUpperCase() === "ISENTO") {
                            return "ISENTO";
                        }

                        // For contributor (1) or others, return digits only
                        return ie.replace(/[^\d]/g, '');
                    })(),
                    email: data.destinatario.email || undefined
                },

                // Items/Products
                det: data.produtos.map((item: any) => {
                    // Determine ICMS configuration based on CRT (Tax Regime)
                    // CRT 1 = Simples Nacional (use ICMSSN with CSOSN codes)
                    // CRT 2 or 3 = Normal Regime (use ICMS with CST codes)
                    const crt = parseInt(data.emittente.regime_tributario || "1");
                    const isSimples = crt === 1;

                    // Valid CSOSN codes for Simples Nacional: 101, 102, 103, 201, 202, 203, 300, 400, 500, 900
                    const validCSOSN = ["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"];
                    const csosn = item.icms_situacao_tributaria;

                    let icmsConfig;

                    if (isSimples) {
                        // Simples Nacional - Use ICMSSN with CSOSN
                        if (!validCSOSN.includes(csosn)) {
                            console.warn(`Invalid CSOSN code "${csosn}" for Simples Nacional. Using 102 as fallback.`);
                        }
                        icmsConfig = {
                            [`ICMSSN${csosn}`]: {
                                orig: parseInt(item.origem || "0"),
                                CSOSN: csosn
                            }
                        };
                    } else {
                        // Regime Normal - Use ICMS with CST
                        const cst = item.icms_situacao_tributaria;

                        // For CST 40, 41, 50, 60 (exemption/suspension/deferral)
                        if (["40", "41", "50", "60"].includes(cst)) {
                            icmsConfig = {
                                [`ICMS${cst}`]: {
                                    orig: parseInt(item.origem || "0"),
                                    CST: cst,
                                    vICMS: 0,
                                    motDesICMS: 9 // Outros (required for exemption cases)
                                }
                            };
                        } else {
                            // For CST 00, 10, 20, 30, 51, 70, 90 (with ICMS calculation)
                            icmsConfig = {
                                [`ICMS${cst}`]: {
                                    orig: parseInt(item.origem || "0"),
                                    CST: cst,
                                    modBC: 0,
                                    vBC: item.valor_total,
                                    pICMS: item.icms_aliquota || 0,
                                    vICMS: (item.valor_total * (item.icms_aliquota || 0)) / 100
                                }
                            };
                        }
                    }

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

        // Log important configuration for debugging
        console.log('=== NF-e Configuration Summary ===');
        console.log('CRT (Tax Regime):', nfePayload.infNFe.emit.CRT);
        console.log('IE (State Registration):', nfePayload.infNFe.emit.IE || 'NOT PROVIDED');
        console.log('Environment:', nfePayload.ambiente);
        console.log('Products count:', nfePayload.infNFe.det.length);
        console.log('First product ICMS:', JSON.stringify(nfePayload.infNFe.det[0]?.imposto?.ICMS, null, 2));
        console.log('Full payload:', JSON.stringify(nfePayload, null, 2));

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
        console.error('=== NF-e Creation Error ===');
        console.error('Status:', error.response?.status);
        console.error('Message:', error.message);

        // Log detailed validation errors from NuvemFiscal
        if (error.response?.data?.error?.errors) {
            console.error('Validation Errors:');
            const errors = error.response.data.error.errors;
            if (Array.isArray(errors)) {
                errors.forEach((err: any, index: number) => {
                    console.error(`  ${index + 1}. ${err.message || err}`);
                    if (err.path) console.error(`     Path: ${err.path}`);
                    if (err.code) console.error(`     Code: ${err.code}`);
                });
            } else {
                console.error(JSON.stringify(errors, null, 2));
            }
        } else if (error.response?.data) {
            console.error('API Response:', JSON.stringify(error.response.data, null, 2));
        }

        // Create user-friendly error message
        let errorMessage = 'Failed to issue NF-e';
        if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
        } else if (error.response?.data?.error?.message) {
            errorMessage = error.response.data.error.message;
        }

        throw new HttpsError(
            'internal',
            errorMessage,
            {
                status: error.response?.status,
                errors: error.response?.data?.error?.errors || null,
                details: error.response?.data
            }
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
