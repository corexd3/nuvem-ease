"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadNFeXML_sandbox = exports.downloadInvoiceXML_sandbox = exports.cancelInvoice_sandbox = exports.queryInvoice_sandbox = exports.issueNFe_sandbox = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
firebase_admin_1.default.initializeApp();
const db = firebase_admin_1.default.firestore();
const NUVEM_BASE_URL = "https://api.sandbox.nuvemfiscal.com.br/";
const NUVEM_AUTH_URL = "https://auth.nuvemfiscal.com.br/oauth/token"; // Auth URL has no 'sandbox' subdomain
const CLIENT_ID = process.env.CLIENT_ID || "";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "";
// UF (State) to IBGE code mapping
const UF_CODE_MAP = {
    'AC': 12, 'AL': 27, 'AP': 16, 'AM': 13, 'BA': 29,
    'CE': 23, 'DF': 53, 'ES': 32, 'GO': 52, 'MA': 21,
    'MT': 51, 'MS': 50, 'MG': 31, 'PA': 15, 'PB': 25,
    'PR': 41, 'PE': 26, 'PI': 22, 'RJ': 33, 'RN': 24,
    'RS': 43, 'RO': 11, 'RR': 14, 'SC': 42, 'SP': 35,
    'SE': 28, 'TO': 17
};
// Helper function to get UF code
function getUFCode(uf) {
    const code = UF_CODE_MAP[uf.toUpperCase()];
    if (!code) {
        console.warn(`Unknown UF: ${uf}, defaulting to 35 (SP)`);
        return 35;
    }
    return code;
}
// Helper function to truncate string to max length
function truncateString(value, maxLength) {
    if (!value || value.trim() === "")
        return undefined;
    const trimmed = value.trim();
    if (trimmed.length <= maxLength)
        return trimmed;
    console.warn(`Truncating field from ${trimmed.length} to ${maxLength} characters: "${trimmed}" -> "${trimmed.substring(0, maxLength)}"`);
    return trimmed.substring(0, maxLength);
}
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
        console.log(response.data.access_token);
        return response.data.access_token;
    }
    catch (error) {
        console.error('OAuth token error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new https_1.HttpsError('internal', `Failed to get OAuth token: ${error.message}`);
    }
}
// Issue NF-e
exports.issueNFe_sandbox = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6;
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
                    cUF: getUFCode(data.emittente.endereco.uf), // State code from emitter's UF
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
                    indIntermed: 0, // 0=Operation without intermediary (direct sale), 1=Operation with intermediary/marketplace
                    procEmi: 0, // 0=Emissão própria
                    verProc: "1.0.0"
                },
                // Emitente - Build emit object with conditional IE
                emit: (() => {
                    var _a, _b;
                    const ie = (_a = data.emittente.inscricao_estadual) === null || _a === void 0 ? void 0 : _a.trim();
                    const crt = parseInt(data.emittente.regime_tributario || "1");
                    // Build base emit object
                    const emitObj = {
                        CNPJ: data.emittente.cpf_cnpj.replace(/[^\d]/g, ''),
                        xNome: truncateString(data.emittente.razao_social, 60) || data.emittente.razao_social.substring(0, 60),
                        xFant: truncateString(data.emittente.nome_fantasia || data.emittente.razao_social, 60) || (data.emittente.nome_fantasia || data.emittente.razao_social).substring(0, 60),
                        enderEmit: {
                            xLgr: truncateString(data.emittente.endereco.logradouro, 60) || data.emittente.endereco.logradouro.substring(0, 60),
                            nro: data.emittente.endereco.numero,
                            xCpl: truncateString(data.emittente.endereco.complemento, 60),
                            xBairro: truncateString(data.emittente.endereco.bairro, 60) || data.emittente.endereco.bairro.substring(0, 60),
                            cMun: data.emittente.endereco.codigo_municipio,
                            xMun: truncateString(data.emittente.endereco.cidade, 60) || data.emittente.endereco.cidade.substring(0, 60),
                            UF: data.emittente.endereco.uf,
                            CEP: data.emittente.endereco.cep.replace(/[^\d]/g, ''),
                            cPais: data.emittente.endereco.codigo_pais || "1058",
                            xPais: truncateString(data.emittente.endereco.pais || "Brasil", 60) || "Brasil",
                            fone: ((_b = data.emittente.endereco.telefone) === null || _b === void 0 ? void 0 : _b.replace(/[^\d]/g, '')) || undefined
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
                        }
                        else {
                            // Clean and validate numeric IE
                            const cleanIE = ie.replace(/[^\d]/g, '');
                            // IE must be 2-14 digits for API validation
                            if (cleanIE.length >= 2 && cleanIE.length <= 14) {
                                emitObj.IE = cleanIE;
                            }
                            else {
                                // Invalid IE - use ISENTO for Simples Nacional
                                console.warn(`Invalid IE "${ie}" (${cleanIE.length} digits). Using ISENTO for Simples Nacional.`);
                                if (crt === 1) {
                                    emitObj.IE = "ISENTO";
                                }
                            }
                        }
                    }
                    else {
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
                dest: Object.assign(Object.assign({}, (data.destinatario.cpf_cnpj.replace(/[^\d]/g, '').length === 11
                    ? { CPF: data.destinatario.cpf_cnpj.replace(/[^\d]/g, '') }
                    : { CNPJ: data.destinatario.cpf_cnpj.replace(/[^\d]/g, '') })), { xNome: truncateString(data.destinatario.razao_social, 60) || data.destinatario.razao_social.substring(0, 60), enderDest: {
                        xLgr: truncateString(data.destinatario.endereco.logradouro, 60) || data.destinatario.endereco.logradouro.substring(0, 60),
                        nro: data.destinatario.endereco.numero,
                        xCpl: truncateString(data.destinatario.endereco.complemento, 60),
                        xBairro: truncateString(data.destinatario.endereco.bairro, 60) || data.destinatario.endereco.bairro.substring(0, 60),
                        cMun: data.destinatario.endereco.codigo_municipio,
                        xMun: truncateString(data.destinatario.endereco.cidade, 60) || data.destinatario.endereco.cidade.substring(0, 60),
                        UF: data.destinatario.endereco.uf,
                        CEP: data.destinatario.endereco.cep.replace(/[^\d]/g, ''),
                        cPais: data.destinatario.endereco.codigo_pais || "1058",
                        xPais: truncateString(data.destinatario.endereco.pais || "Brasil", 60) || "Brasil",
                        fone: ((_j = data.destinatario.telefone) === null || _j === void 0 ? void 0 : _j.replace(/[^\d]/g, '')) || undefined
                    }, indIEDest: parseInt(data.destinatario.indicador_ie || "9"), IE: (() => {
                        const indicador = data.destinatario.indicador_ie;
                        const ie = data.destinatario.inscricao_estadual;
                        // If empty or null, return undefined (will be omitted)
                        if (!ie || ie.trim() === "")
                            return undefined;
                        // For exempt (2), allow "ISENTO" string
                        if (indicador === "2" && ie.toUpperCase() === "ISENTO") {
                            return "ISENTO";
                        }
                        // For contributor (1) or others, return digits only
                        return ie.replace(/[^\d]/g, '');
                    })(), email: data.destinatario.email || undefined }),
                // Items/Products
                det: data.produtos.map((item, index) => {
                    // Determine ICMS configuration based on CRT (Tax Regime)
                    // CRT 1 = Simples Nacional (use ICMSSN with CSOSN codes)
                    // CRT 2 or 3 = Normal Regime (use ICMS with CST codes)
                    const crt = parseInt(data.emittente.regime_tributario || "1");
                    const isSimples = crt === 1;
                    // Valid CSOSN codes for Simples Nacional: 101, 102, 103, 201, 202, 203, 300, 400, 500, 900
                    const validCSOSN = ["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"];
                    const csosn = item.icms_situacao_tributaria;
                    let icmsConfig;
                    let vBC = 0;
                    let vICMS = 0;
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
                        // For Simples Nacional, typically no vBC/vICMS in item level
                        vBC = 0;
                        vICMS = 0;
                    }
                    else {
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
                            vBC = 0;
                            vICMS = 0;
                        }
                        else {
                            // For CST 00, 10, 20, 30, 51, 70, 90 (with ICMS calculation)
                            const baseCalculo = item.base_calculo_icms || item.valor_total;
                            const aliquotaICMS = item.icms_aliquota || 0;
                            vBC = baseCalculo;
                            vICMS = (baseCalculo * aliquotaICMS) / 100;
                            icmsConfig = {
                                [`ICMS${cst}`]: {
                                    orig: parseInt(item.origem || "0"),
                                    CST: cst,
                                    modBC: parseInt(item.modalidade_bc || "0"), // 0=Margem Valor Agregado, 1=Pauta, 2=Preço Tabelado, 3=Valor da operação
                                    vBC: parseFloat(vBC.toFixed(2)),
                                    pICMS: aliquotaICMS,
                                    vICMS: parseFloat(vICMS.toFixed(2))
                                }
                            };
                        }
                    }
                    // Store vBC and vICMS for totals calculation
                    item._calculatedVBC = vBC;
                    item._calculatedVICMS = vICMS;
                    return {
                        nItem: index + 1, // Use array index to ensure unique sequential numbers
                        prod: {
                            cProd: truncateString(item.codigo, 60) || item.codigo.substring(0, 60),
                            cEAN: item.cean || "SEM GTIN",
                            xProd: truncateString(item.descricao, 120) || item.descricao.substring(0, 120),
                            NCM: item.ncm.replace(/[^\d]/g, ''),
                            CEST: item.cest || undefined,
                            CFOP: item.cfop,
                            uCom: truncateString(item.unidade, 6) || item.unidade.substring(0, 6),
                            qCom: parseFloat(item.quantidade),
                            vUnCom: parseFloat(item.valor_unitario.toFixed(10)),
                            vProd: parseFloat(item.valor_total.toFixed(2)),
                            cEANTrib: item.cean || "SEM GTIN",
                            uTrib: truncateString(item.unidade, 6) || item.unidade.substring(0, 6),
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
                // Totals - Calculate from items
                total: {
                    ICMSTot: {
                        vBC: data.produtos.reduce((sum, item) => sum + (item._calculatedVBC || 0), 0),
                        vICMS: data.produtos.reduce((sum, item) => sum + (item._calculatedVICMS || 0), 0),
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
                    modFrete: parseInt(((_k = data.transporte) === null || _k === void 0 ? void 0 : _k.modalidade_frete) || "9")
                },
                // Payment
                pag: {
                    detPag: ((_m = (_l = data.pagamento) === null || _l === void 0 ? void 0 : _l.formas_pagamento) === null || _m === void 0 ? void 0 : _m.map((fp) => ({
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
        // Log important configuration for debugging
        console.log('=== NF-e Configuration Summary ===');
        console.log('CRT (Tax Regime):', nfePayload.infNFe.emit.CRT);
        console.log('IE (State Registration):', nfePayload.infNFe.emit.IE || 'NOT PROVIDED');
        console.log('Environment:', nfePayload.ambiente);
        console.log('Products count:', nfePayload.infNFe.det.length);
        console.log('First product ICMS:', JSON.stringify((_p = (_o = nfePayload.infNFe.det[0]) === null || _o === void 0 ? void 0 : _o.imposto) === null || _p === void 0 ? void 0 : _p.ICMS, null, 2));
        console.log('Full payload:', JSON.stringify(nfePayload, null, 2));
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
            customer_name: ((_q = data.destinatario) === null || _q === void 0 ? void 0 : _q.nome) || ((_r = data.destinatario) === null || _r === void 0 ? void 0 : _r.razao_social) || null,
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
        console.error('=== NF-e Creation Error ===');
        console.error('Status:', (_s = error.response) === null || _s === void 0 ? void 0 : _s.status);
        console.error('Message:', error.message);
        // Log detailed validation errors from NuvemFiscal
        if ((_v = (_u = (_t = error.response) === null || _t === void 0 ? void 0 : _t.data) === null || _u === void 0 ? void 0 : _u.error) === null || _v === void 0 ? void 0 : _v.errors) {
            console.error('Validation Errors:');
            const errors = error.response.data.error.errors;
            if (Array.isArray(errors)) {
                errors.forEach((err, index) => {
                    console.error(`  ${index + 1}. ${err.message || err}`);
                    if (err.path)
                        console.error(`     Path: ${err.path}`);
                    if (err.code)
                        console.error(`     Code: ${err.code}`);
                });
            }
            else {
                console.error(JSON.stringify(errors, null, 2));
            }
        }
        else if ((_w = error.response) === null || _w === void 0 ? void 0 : _w.data) {
            console.error('API Response:', JSON.stringify(error.response.data, null, 2));
        }
        // Create user-friendly error message
        let errorMessage = 'Failed to issue NF-e';
        if ((_y = (_x = error.response) === null || _x === void 0 ? void 0 : _x.data) === null || _y === void 0 ? void 0 : _y.message) {
            errorMessage = error.response.data.message;
        }
        else if ((_1 = (_0 = (_z = error.response) === null || _z === void 0 ? void 0 : _z.data) === null || _0 === void 0 ? void 0 : _0.error) === null || _1 === void 0 ? void 0 : _1.message) {
            errorMessage = error.response.data.error.message;
        }
        throw new https_1.HttpsError('internal', errorMessage, {
            status: (_2 = error.response) === null || _2 === void 0 ? void 0 : _2.status,
            errors: ((_5 = (_4 = (_3 = error.response) === null || _3 === void 0 ? void 0 : _3.data) === null || _4 === void 0 ? void 0 : _4.error) === null || _5 === void 0 ? void 0 : _5.errors) || null,
            details: (_6 = error.response) === null || _6 === void 0 ? void 0 : _6.data
        });
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
// Download NF-e XML by invoice_id (from Firestore)
exports.downloadInvoiceXML_sandbox = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "Authentication required");
        }
        const { invoice_id } = request.data;
        if (!invoice_id) {
            throw new https_1.HttpsError("invalid-argument", "invoice_id required");
        }
        // Get invoice from Firestore
        const invoiceDoc = await db.collection("invoices").doc(invoice_id).get();
        if (!invoiceDoc.exists) {
            throw new https_1.HttpsError("not-found", "Invoice not found");
        }
        const invoiceData = invoiceDoc.data();
        const nfeId = invoiceData === null || invoiceData === void 0 ? void 0 : invoiceData.nfe_id;
        if (!nfeId) {
            throw new https_1.HttpsError("invalid-argument", "NF-e ID not found in invoice");
        }
        // Get OAuth access token
        const nuvemToken = await getNuvemFiscalToken();
        // Download XML from NuvemFiscal
        const response = await axios_1.default.get(`${NUVEM_BASE_URL}nfe/${nfeId}/xml`, {
            headers: {
                'Authorization': `Bearer ${nuvemToken}`,
                'Accept': 'application/xml'
            },
            responseType: 'text' // Ensure we get the XML as text
        });
        console.log('XML downloaded successfully for invoice:', invoice_id);
        return {
            success: true,
            xml: response.data,
            invoice_id: invoice_id,
            nfe_id: nfeId
        };
    }
    catch (error) {
        console.error('Download XML error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new https_1.HttpsError('internal', 'Failed to download NF-e XML', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
    }
});
// Download NF-e XML directly by nfe_id
exports.downloadNFeXML_sandbox = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "Authentication required");
        }
        const { nfe_id } = request.data;
        if (!nfe_id) {
            throw new https_1.HttpsError("invalid-argument", "nfe_id required");
        }
        // Get OAuth access token
        const nuvemToken = await getNuvemFiscalToken();
        // Download XML from NuvemFiscal
        const response = await axios_1.default.get(`${NUVEM_BASE_URL}nfe/${nfe_id}/xml`, {
            headers: {
                'Authorization': `Bearer ${nuvemToken}`,
                'Accept': 'application/xml'
            },
            responseType: 'text' // Ensure we get the XML as text
        });
        console.log('XML downloaded successfully for NF-e:', nfe_id);
        return {
            success: true,
            xml: response.data,
            nfe_id: nfe_id
        };
    }
    catch (error) {
        console.error('Download XML error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new https_1.HttpsError('internal', 'Failed to download NF-e XML', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
    }
});
//# sourceMappingURL=index.js.map