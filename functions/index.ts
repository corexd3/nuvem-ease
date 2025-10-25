import * as functions from "firebase-functions";
import admin from 'firebase-admin';
import axios from 'axios';
import fs from 'fs';
import * as os from 'os';
import * as dotenv from "dotenv";
import { defineString } from "firebase-functions/params";

dotenv.config();

admin.initializeApp();
const db = admin.firestore();

const nuvemBaseUrl = defineString('NUVEMFISCAL_BASE_URL').value() || process.env.NUVEMFISCAL_BASE_URL || ('').replace(/\/?$/, '/');
const nuvemApiKey = defineString('NUVEMFISCAL_API_KEY').value() || process.env.NUVEMFISCAL_API_KEY || "";
const CLIENT_ID = defineString('NUVEM_CLIENT_ID').value() || process.env.NUVEM_CLIENT_ID;
const CLIENT_SECRET = defineString('NUVEM_CLIENT_SECRET').value() || process.env.NUVEM_CLIENT_SECRET || "";

// Configure certificates if needed
const pfxBase64 = process.env.CERT_PFX_BASE64;
const pfxPassword = process.env.CERT_PFX_PASSWORD;
if (pfxBase64) {
    const pfxPath = `${os.tmpdir()}/cert.pfx`;
    fs.writeFileSync(pfxPath, Buffer.from(pfxBase64, 'base64'));
}

// async function getTokenFromStore(id : number) {
//     const doc = await db.collection("TOKEN_DOC").doc(id).get();
//     return doc.exists ? doc.data() : null;
// }
// async function saveTokenToStore(id : number, tokenObj : any) {
//     await db.collection("TOKEN_DOC").doc(id).set(tokenObj, { merge: true });
// }


// async function getNewToken() {
//     const params = new URLSearchParams();
//     params.append("grant_type", "client_credentials");
//     params.append("client_id", CLIENT_ID || "");
//     params.append("client_secret", CLIENT_SECRET || "");
//     params.append("scope", "nfce:write nfce:read");

//     const response = await axios.post(`${nuvemBaseUrl}oauth/token`, params, {
//         headers: {
//             'Content-Type': 'application/x-www-form-urlencoded'
//         },
//         timeout: 10000
//     });
//     const now = Date.now();
//     const expireIn = response.data.expires_in || 3600;
//     const expireOut = now + (expireIn * 1000);
//     const tokenObj = {
//         access_token: response.data.access_token,
//         token_type: response.data.token_type,
//         expires_in: expireIn,
//         expire_out: expireOut,
//         updated_at: admin.firestore.Timestamp.now()
//     };
//     await saveTokenToStore(tokenObj);
//     return tokenObj;
// }

// async function getValidToken() {
//     const storedToken = await getTokenFromStore();
//     const now = Date.now();

//     if (storedToken && storedToken.access_token && storedToken.expire_out && storedToken.expire_out > now + 60000) {
//         return storedToken.access_token;
//     }
//     const newToken = await getNewToken();
//     return newToken.access_token;
// }

export const createInvoice = functions.https.onCall(async (request) => {
    try {

        console.log('🔧 Environment check:');
        console.log('- nuvemBaseUrl:', nuvemBaseUrl);
        console.log('- nuvemApiKey exists:', !!nuvemApiKey);
        console.log('- CLIENT_ID exists:', !!CLIENT_ID);

        if (!nuvemBaseUrl || !nuvemApiKey) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Environment variables not configured properly'
            );
        }

        if (!request.auth) {
            throw new functions.https.HttpsError("unauthenticated", "You must be authenticated to call this function.");
        }
        const uid = request.auth.uid;
        console.log('✅ User authenticated:', uid);
        if (!uid) {
            throw new Error("Invalid user ID");
        }

        const data = request.data;
        console.log('📥 Received data:', JSON.stringify(data, null, 2));

        // Validate required fields
        if (!data?.cliente?.nome || !data?.cliente?.cpf_cnpj) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Missing required customer data',
                { required: ['cliente.nome', 'cliente.cpf_cnpj'] }
            );
        }

        if (!data?.total || !data?.itens?.length) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Missing invoice data',
                { required: ['total', 'itens'] }
            );
        }

        const cliente_nome = data.cliente.nome;
        const cnpj = data.cliente.cpf_cnpj;

        console.log("Getting initial oauth token");
        const rid = CLIENT_ID;
        const initialTokenResp = await axios.post(
            `${nuvemBaseUrl}oauth/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: String(CLIENT_ID || ""),
                client_secret: String(CLIENT_SECRET || ""),
                scope: "nfce:write nfce:read"
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        ).catch(error => {
            console.error('❌ OAuth token error:', error.response?.data || error.message);
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Failed to authenticate with NuvemFiscal',
                error.response?.data || error.message
            );
        });
        const initialToken = initialTokenResp.data.access_token;
        console.log('📝 Creating customer record...');
        const customerRef = db.collection("customers").doc();
        await customerRef.set({
            user_id: uid,
            name: cliente_nome,
            cpf_cnpj: cnpj,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            status: "creating in Nuvemfiscal"
        });
        console.log('✅ Customer record created:', customerRef.id);

        console.log('🌐 Calling NuvemFiscal API...');
        console.log('URL:', `${nuvemBaseUrl}/v2/empresas`);
        const nfcrep = await axios.post(`${nuvemBaseUrl}v2/empresas`, {
            nome: cliente_nome,
            cnpj
        }, {
            headers: {
                Authorization: `Bearer ${initialToken}`,
                "Content-Type": 'application/json'
            }
        }).catch((error) => {
            console.error('❌ Company creation error:', error.response?.data || error.message)
            throw new functions.https.HttpsError(
                'internal',
                'Failed to register company',
                error.response?.data || error.message
            );
        })

        console.log('✅ NuvemFiscal registration successful');

        const { client_id, client_password } = nfcrep.data;

        console.log('🔐 Getting company-specific OAuth token...');
        const tokenResp = await axios.post(`${nuvemBaseUrl}oauth/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: client_id,
                client_secret: client_password,
                scope: "nfce:write nfce:read"
            }), {
            headers: {
                "Content-Type": 'Application/x-www-form-urlencoded'
            }
        }
        );

        console.log('✅ company-specific OAuth token received');


        await db.collection("nuvemfiscal_clients").doc(customerRef.id).set({
            client_id,
            client_password,
            access_token: tokenResp.data.access_token,
            expires_at: Date.now() + (tokenResp.data.expires_in * 1000)
        });

        console.log('📄 Creating NFCe...');
        await customerRef.update({ status: "created in Nuvemfiscal" });
        // Call NuvemFiscal API to create invoice
        console.log("creating NFC...");
        const token = tokenResp.data.access_token;
        const inputData = {
            "ambiente": "homologacao", // Use "producao" for production
            "referencia": `invoice_${customerRef.id}`,
            "emissor": {
                "cpf_cnpj": data.cliente.cpf_cnpj,
                "inscricao_estadual": data.cliente.inscricao_estadual || "ISENTO",
                "razao_social": data.cliente.nome,
                "nome_fantasia": data.cliente.nome_fantasia || data.cliente.nome,
                "endereco": {
                    "logradouro": data.cliente.endereco?.logradouro || "Av. Ejemplo",
                    "numero": data.cliente.endereco?.numero || "1000",
                    "complemento": data.cliente.endereco?.complemento || "Sala 1",
                    "bairro": data.cliente.endereco?.bairro || "Centro",
                    "codigo_municipio": data.cliente.endereco?.codigo_municipio || "3550308",
                    "uf": data.cliente.endereco?.uf || "SP",
                    "cep": data.cliente.endereco?.cep || "01000000",
                    "codigo_pais": "1058",
                    "descricao_pais": "Brasil"
                },
                "telefone": data.cliente.telefone || "",
                "email": data.cliente.email || ""
            },
            "itens": data.itens.map((item: any, index: number) => ({
                "numero_item": (index + 1).toString(),
                "codigo_produto": item.codigo_produto || `PROD${index + 1}`,
                "descricao": item.product_name,
                "cfop": "5102",
                "unidade_comercial": item.unidade || "UN",
                "quantidade_comercial": item.quantity,
                "valor_unitario_comercial": item.unit_value,
                "valor_bruto": item.total_value,
                "unidade_tributavel": item.unidade || "UN",
                "quantidade_tributavel": item.quantity,
                "valor_unitario_tributavel": item.unit_value,
                "valor_total": item.total_value,
                "icms_origem": "0",
                "icms_situacao_tributaria": "102"
            })),
            "totais": {
                "icms_base_calculo": "0.00",
                "icms_valor_total": "0.00",
                "icms_valor_total_desonerado": "0.00",
                "valor_produtos": data.total,
                "valor_desconto": data.desconto || "0.00",
                "valor_total": data.total,
                "valor_a_pagar": data.total
            },
            "pagamentos": data.pagamentos?.map((pag: any) => ({
                "forma_pagamento": pag.forma_pagamento || "01",
                "valor_pagamento": pag.valor || data.total,
                "meio_pagamento": pag.meio_pagamento || "01"
            })) || [{
                "forma_pagamento": "01",
                "valor_pagamento": data.total,
                "meio_pagamento": "01"
            }],
            "informacoes_adicionais_contribuinte": data.observacao || "Nota Fiscal gerada via aplicação móvel"
        };
        console.log('📤 Sending NFCe data:', JSON.stringify(inputData, null, 2));

        const result = await axios.post(`${nuvemBaseUrl}v2/nfce`, inputData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }).catch(error => {
            console.error('❌ NFCe creation error:', error.response?.data || error.message);
            throw new functions.https.HttpsError(
                'internal',
                'Error creating NFCe',
                error.response?.data || error.message
            );
        });
        // 4 Write invoice + items to Firestore in a batch
        const batch = db.batch();
        const invoiceRef = db.collection("invoices").doc();
        batch.set(invoiceRef, {
            user_id: uid,
            nfce_id: result.data.id,
            status: "processing",
            customer: data.cliente,
            total_value: data.total,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        data.itens.forEach((item: any) => {
            const itemRef = db.collection("invoice_items").doc();
            batch.set(itemRef, {
                invoice_id: invoiceRef.id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_value: item.unit_value,
                total_value: item.total_value,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        await batch.commit();

        return { success: true, data: result.data };
    } catch (error: any) {
        console.log('Invoice creation failed:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Invoice creation failed',
            error.response?.data || error.message
        );
    }
});




export const getInvoiceStatus = functions.https.onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }
        
        const data = request.data;
        
        if (!data?.invoiceId) {
            throw new functions.https.HttpsError('invalid-argument', 'invoiceId is required');
        }

        const invoiceDoc = await db.collection("invoices").doc(data.invoiceId).get();
        
        if (!invoiceDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Invoice not found');
        }

        const invoiceData = invoiceDoc.data();
        const customerId = invoiceData?.customer_id;
        
        const clientDoc = await db.collection("nuvemfiscal_clients").doc(customerId).get();
        
        if (!clientDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Customer credentials not found');
        }

        const clientData = clientDoc.data();
        let token = clientData?.access_token;
        
        // Check if token is expired and refresh if needed
        if (clientData?.expires_at < Date.now()) {
            // ✅ FIX: Properly construct URLSearchParams
            const refreshParams = new URLSearchParams();
            refreshParams.append("grant_type", "client_credentials");
            refreshParams.append("client_id", clientData.client_id);
            refreshParams.append("client_secret", clientData.client_password);
            refreshParams.append("scope", "nfce:write nfce:read");

            const tokenResp = await axios.post(
                `${nuvemBaseUrl}oauth/token`,
                refreshParams,
                {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    timeout: 10000
                }
            );
            
            token = tokenResp.data.access_token;
            
            await db.collection("nuvemfiscal_clients").doc(customerId).update({
                access_token: token,
                expires_at: Date.now() + (tokenResp.data.expires_in * 1000)
            });
        }

        const nfceId = invoiceData?.nfce_id;
        const response = await axios.get(
            `${nuvemBaseUrl}v2/nfce/${nfceId}`, 
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        await db.collection("invoices").doc(data.invoiceId).update({
            status: response.data.status,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            status: response.data.status,
            data: response.data
        };
    } catch (error: any) {
        console.error('Error fetching invoice status:', error.response?.data || error.message);
        throw new functions.https.HttpsError(
            'internal', 
            'Error fetching invoice status', 
            error.response?.data || error.message
        );
    }
});

export const cancelInvoice = functions.https.onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const data = request.data;
        
        if (!data?.invoiceId || !data?.justificativa) {
            throw new functions.https.HttpsError(
                'invalid-argument', 
                'invoiceId and justificativa (reason) are required'
            );
        }

        const invoiceDoc = await db.collection("invoices").doc(data.invoiceId).get();
        
        if (!invoiceDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Invoice not found');
        }

        const invoiceData = invoiceDoc.data();
        const customerId = invoiceData?.customer_id;
        
        const clientDoc = await db.collection("nuvemfiscal_clients").doc(customerId).get();
        
        if (!clientDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Customer credentials not found');
        }

        const clientData = clientDoc.data();
        let token = clientData?.access_token;
        
        // Refresh token if expired
        if (clientData?.expires_at < Date.now()) {
            // ✅ FIX: Properly construct URLSearchParams
            const refreshParams = new URLSearchParams();
            refreshParams.append("grant_type", "client_credentials");
            refreshParams.append("client_id", clientData.client_id);
            refreshParams.append("client_secret", clientData.client_password);
            refreshParams.append("scope", "nfce:write nfce:read");

            const tokenResp = await axios.post(
                `${nuvemBaseUrl}oauth/token`,
                refreshParams,
                {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    timeout: 10000
                }
            );
            
            token = tokenResp.data.access_token;
            
            await db.collection("nuvemfiscal_clients").doc(customerId).update({
                access_token: token,
                expires_at: Date.now() + (tokenResp.data.expires_in * 1000)
            });
        }

        const nfceId = invoiceData?.nfce_id;
        
        const response = await axios.post(
            `${nuvemBaseUrl}v2/nfce/${nfceId}/cancelamento`, 
            {
                justificativa: data.justificativa
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        await db.collection("invoices").doc(data.invoiceId).update({
            status: "cancelled",
            cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
            cancellation_reason: data.justificativa
        });

        return {
            success: true,
            data: response.data
        };
    } catch (error: any) {
        console.error('Error cancelling invoice:', error.response?.data || error.message);
        throw new functions.https.HttpsError(
            'internal', 
            'Error cancelling invoice', 
            error.response?.data || error.message
        );
    }
});

