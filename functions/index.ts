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

const nuvemBaseUrl = (defineString('NUVEMFISCAL_BASE_URL').value() || process.env.NUVEMFISCAL_BASE_URL || '').replace(/\/?$/, '/');
const nuvemApiKey = defineString('NUVEMFISCAL_API_KEY').value() || process.env.NUVEMFISCAL_API_KEY;
const CLIENT_ID = defineString('NUVEM_CLIENT_ID').value() || process.env.NUVEM_CLIENT_ID;
// const CLIENT_SECRET = defineString('NUVEM_CLIENT_SECRET') || process.env.NUVEM_CLIENT_SECRET;

// Configure certificates if needed
const pfxBase64 = process.env.cert_pfx_password;;
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
        if(!uid){
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

        // Validate items structure
        const invalidItems = data.itens.filter((item: any) => {
            return !item.product_name || 
                   typeof item.quantity !== 'number' || 
                   typeof item.unit_value !== 'number' ||
                   typeof item.total_value !== 'number';
        });

        if (invalidItems.length > 0) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Invalid item structure',
                { 
                    required: ['product_name', 'quantity', 'unit_value', 'total_value'],
                    invalidItems: invalidItems 
                }
            );
        }

        // Validate total matches sum of items
        const calculatedTotal = data.itens.reduce((sum: number, item: any) => 
            sum + (item.total_value || 0), 0
        );
        
        if (Math.abs(calculatedTotal - data.total) > 0.01) { // Allow for small floating point differences
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Total amount does not match sum of items',
                { 
                    expected: data.total,
                    calculated: calculatedTotal
                }
            );
        }

        const cliente_nome = data.cliente.nome;
        const cnpj = data.cliente.cpf_cnpj;

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
        console.log('URL:', `${nuvemBaseUrl}v2/empresas`);
        const nfcrep = await axios.post(`${nuvemBaseUrl}v2/empresas`, {
            nome: cliente_nome,
            cnpj
        }, {
            headers: {
                Authorization: `Bearer ${nuvemApiKey}`,
            }
        });
        console.log('✅ NuvemFiscal registration successful');

        const { client_id, client_password } = nfcrep.data;

        console.log('🔐 Getting OAuth token...');
        const tokenResp = await axios.post(`${nuvemBaseUrl}oauth/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: client_id,
                client_secret: client_password,
                scope: "nfce:write nfce:read"
            })
        );

        console.log('✅ OAuth token received');


        await db.collection("nuvemfiscal_clients").doc(customerRef.id).set({
            client_id,
            client_password,
            access_token: tokenResp.data.access_token,
            expires_at: Date.now() + (tokenResp.data.expires_in * 1000)
        });

        console.log('📄 Creating NFCe...');
        await customerRef.update({ status: "created in Nuvemfiscal" });
        // Call NuvemFiscal API to create invoice
        const token = tokenResp.data.access_token;
        const inputData = {
            "ambiente": "producao",
            "emissor": {
                "cpf_cnpj": data.cliente.cpf_cnpj,
                "inscricao_estadual": "123456789012",
                "razao_social": data.cliente.nome,
                "nome_fantasia": data.cliente.nome,
                "endereco": {
                    "logradouro": "Av. Ejemplo",
                    "numero": "1000",
                    "complemento": "Tienda 1",
                    "bairro": "Centro",
                    "codigoMunicipio": "3550308",
                    "nomeMunicipio": "São Paulo",
                    "uf": "SP",
                    "cep": "01000-000",
                    "pais": "BR"
                }
            },
            "totais": {
                "valorTotal": data.total,
                "valorImpostos": "0.00"
            },
            "pagamentos": [
                {
                    "formaPagamento": "03",
                    "valor": data.total.toString()
                }
            ],
            "informacoesAdicionais": {
                "observacaoConsumidor": "Compra vía aplicación móvil"
            }
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
        console.error('Invoice creation failed:', error);
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Error creating invoice',
            error.response?.data || error
        );
    }
});




export const getInvoiceStatus = functions.https.onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { invoiceId } = request.data;
        if (!invoiceId) {
            throw new functions.https.HttpsError('invalid-argument', 'Invoice ID is required');
        }

        // Call external API to get invoice status
        const response = await axios.get(`${nuvemBaseUrl}v2/nfce/${invoiceId}/status`, {
            headers: {
                'Authorization': `Bearer ${nuvemApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error: any) {
        console.error('Error fetching invoice status:', error);
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Error fetching invoice status',
            error.response?.data || error
        );
    }
});

export const cancelInvoice = functions.https.onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { invoiceId } = request.data;
        if (!invoiceId) {
            throw new functions.https.HttpsError('invalid-argument', 'Invoice ID is required');
        }

        // First, verify the invoice belongs to the user
        const invoiceDoc = await db.collection('invoices')
            .where('nfce_id', '==', invoiceId)
            .where('user_id', '==', request.auth.uid)
            .limit(1)
            .get();

        if (invoiceDoc.empty) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Invoice not found or does not belong to the user'
            );
        }

        // Call external API to cancel invoice
        const response = await axios.post(`${nuvemBaseUrl}v2/nfce/${invoiceId}/cancelar`, {}, {
            headers: {
                'Authorization': `Bearer ${nuvemApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        // Update invoice status in Firestore
        await invoiceDoc.docs[0].ref.update({
            status: 'cancelled',
            cancelled_at: admin.firestore.FieldValue.serverTimestamp()
        });

        return response.data;
    } catch (error: any) {
        console.error('Error cancelling invoice:', error);
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Error cancelling invoice',
            error.response?.data || error
        );
    }
});


