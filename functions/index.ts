import * as functions from "firebase-functions";
import admin from 'firebase-admin';
import axios from 'axios';
import fs from 'fs';
import tmp from 'os';


admin.initializeApp();
const db = admin.firestore();

const nuvemBaseUrl = process.env.NEXT_PUBLIC_NUVEMFISCAL_BASE_URL;
const nuvemApiKey = process.env.NEXT_PUBLIC_NUVEMFISCAL_API_KEY;
const master_token = functions.config().nuvemfiscal?.master_token || process.env.NUVEMFISCAL_MASTER_TOKEN;

// Configure certificates if needed
const pfxBase64 = process.env.cert_pfx_password;;
if (pfxBase64) {
    const pfxPath = `${tmp.tmpdir()}/cert.pfx`;
    fs.writeFileSync(pfxPath, Buffer.from(pfxBase64, 'base64'));
}

async function getTokenFromStore(id : number) {
    const doc = await db.collection("TOKEN_DOC").doc(id).get();
    return doc.exists ? doc.data() : null;
}
async function saveTokenToStore(id : number, tokenObj : any) {
    await db.collection("TOKEN_DOC").doc(id).set(tokenObj, { merge: true });
}

const CLIENT_ID = process.env.NUVEM_CLIENT_ID;
const CLIENT_SECRET = process.env.NUVEM_CLIENT_SECRET;

async function getNewToken() {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", CLIENT_ID || "");
    params.append("client_secret", CLIENT_SECRET || "");
    params.append("scope", "nfce:write nfce:read");

    const response = await axios.post(`${nuvemBaseUrl}oauth/token`, params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
    });
    const now = Date.now();
    const expireIn = response.data.expires_in || 3600;
    const expireOut = now + (expireIn * 1000);
    const tokenObj = {
        access_token: response.data.access_token,
        token_type: response.data.token_type,
        expires_in: expireIn,
        expire_out: expireOut,
        updated_at: admin.firestore.Timestamp.now()
    };
    await saveTokenToStore(tokenObj);
    return tokenObj;
}

async function getValidToken() {
    const storedToken = await getTokenFromStore();
    const now = Date.now();

    if (storedToken && storedToken.access_token && storedToken.expire_out && storedToken.expire_out > now + 60000) {
        return storedToken.access_token;
    }
    const newToken = await getNewToken();
    return newToken.access_token;
}

export const createInvoice = functions.https.onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError("unauthenticated", "You must be authenticated to call this function.");
        }


        const uid = request.auth.uid;
        const data = request.data;
        const cliente_nome = data.cliente.nome;
        const cnpj = data.cliente.cpf_cnpj;

        const customerRef = db.collection("customers").doc();
        await customerRef.set({
            user_id: uid,
            name: cliente_nome,
            cpf_cnpj: cnpj,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            status: "creating in Nuvemfiscal"
        });

        const nfcrep = await axios.post(`${nuvemBaseUrl}v2/empresas`, {
            nome: cliente_nome,
            cnpj
        }, {
            headers: {
                Authorization: `Bearer ${nuvemApiKey}`,
            }
        });

        const { client_id, client_password } = nfcrep.data;
        const tokenResp = await axios.post(`${nuvemBaseUrl}oauth/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: client_id,
                client_secret: client_password,
                scope: "nfce:write nfce:read"
            })
        );

        await db.collection("nuvemfiscal_clients").doc(customerRef.id).set({
            client_id,
            client_password,
            access_token: tokenResp.data.access_token,
            expires_at: Date.now() + (tokenResp.data.expires_in * 1000)
        });

        await customerRef.update({ status: "created in Nuvemfiscal" });
        // Call NuvemFiscal API to create invoice
        const token = tokenResp.data.access_token;
        const inputData = {
            "ambiente": " producción",
            "emisor": {
                "CNPJ": data.cliente.cpf_cnpj,
                "inscricaoEstadual": "123456789012",
                "razãoSocial": data.cliente.nome,
                "nomeFantasia": "ACME Tienda",
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
                    "valor": "150.00"
                }
            ],
            "informacoesAdicionais": {
                "observacaoConsumidor": "Compra vía aplicación móvil"
            }
        };
        const result = await axios.post(`${nuvemBaseUrl}v2/nfce`, inputData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
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
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'Error creating invoice', error);
    }
});




export const getInvoiceStatus = functions.https.onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }
        // Call external API to get invoice status
        const data = request.data;
        const response = await axios.get(`${nuvemBaseUrl}nfce/${data.invoiceId}/status`, {
            headers: {
                'Authorization': `Bearer ${nuvemApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.status === 200) {
            return response.data;
        }
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'Error fetching invoice status', error);
    }
});
export const cancelInvoice = functions.https.onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }
        // Call external API to cancel invoice
        const uid = request.auth.uid;
        const data = request.data;
        const response = await axios.post(`${nuvemBaseUrl}nfce/${data.invoiceId}/cancel`, {}, {
            headers: {
                'Authorization': `Bearer ${nuvemApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.status === 200) {
            return response.data;
        }
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'Error cancelling invoice', error);
    }
});


