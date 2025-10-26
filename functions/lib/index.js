import * as functions from "firebase-functions";
import admin from 'firebase-admin';
import axios from 'axios';
admin.initializeApp();
const db = admin.firestore();
const NUVEM_API_KEY = process.env.NUVEMFISCAL_API_KEY || "";
const NUVEM_BASE_URL = "https://api.nuvemfiscal.com.br/";
// Issue NF-e
export const issueNFe = functions.https.onCall(async (request) => {
    var _a, _b, _c;
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required");
        }
        const data = request.data;
        const uid = request.auth.uid;
        // Validate required fields
        if (!((_a = data === null || data === void 0 ? void 0 : data.emittente) === null || _a === void 0 ? void 0 : _a.cpf_cnpj) || !(data === null || data === void 0 ? void 0 : data.destinatario) || !(data === null || data === void 0 ? void 0 : data.produtos)) {
            throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
        }
        // Create NF-e in NuvemFiscal
        const nfePayload = {
            ambiente: "homologacao",
            referencia: `nfe_${Date.now()}`,
            emitente: {
                cpf_cnpj: data.emittente.cpf_cnpj,
                inscricao_estadual: data.emittente.inscricao_estadual,
                razao_social: data.emittente.razao_social,
                endereco: data.emittente.endereco
            },
            destinatario: {
                cpf_cnpj: data.destinatario.cpf_cnpj,
                razao_social: data.destinatario.razao_social,
                endereco: data.destinatario.endereco
            },
            itens: data.produtos.map((item, index) => ({
                numero_item: (index + 1).toString(),
                codigo_produto: item.codigo,
                descricao: item.descricao,
                cfop: item.cfop,
                ncm: item.ncm,
                unidade_comercial: item.unidade,
                quantidade_comercial: item.quantidade,
                valor_unitario_comercial: item.valor_unitario,
                valor_bruto: item.valor_total,
                icms_origem: "0",
                icms_situacao_tributaria: item.cst_icms || "102"
            })),
            pagamento: data.pagamento
        };
        const result = await axios.post(`${NUVEM_BASE_URL}v2/nfe`, nfePayload, {
            headers: {
                'Authorization': `Bearer ${NUVEM_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        // Save to Firestore
        const invoiceRef = db.collection("invoices").doc();
        await invoiceRef.set({
            user_id: uid,
            nfe_id: result.data.id,
            type: "nfe",
            status: result.data.status || "processing",
            emittente: data.emittente,
            destinatario: data.destinatario,
            produtos: data.produtos,
            valor_total: data.produtos.reduce((sum, p) => sum + p.valor_total, 0),
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            invoice_id: invoiceRef.id,
            nfe_id: result.data.id,
            data: result.data
        };
    }
    catch (error) {
        console.error('NF-e creation error:', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
        throw new functions.https.HttpsError('internal', 'Failed to issue NF-e', ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message);
    }
});
// Query invoice status
export const queryInvoice = functions.https.onCall(async (request) => {
    var _a, _b;
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required");
        }
        const { invoice_id } = request.data;
        if (!invoice_id) {
            throw new functions.https.HttpsError("invalid-argument", "invoice_id required");
        }
        const invoiceDoc = await db.collection("invoices").doc(invoice_id).get();
        if (!invoiceDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Invoice not found");
        }
        const invoiceData = invoiceDoc.data();
        const nfeId = invoiceData === null || invoiceData === void 0 ? void 0 : invoiceData.nfe_id;
        // Query NuvemFiscal
        const response = await axios.get(`${NUVEM_BASE_URL}v2/nfe/${nfeId}`, {
            headers: {
                'Authorization': `Bearer ${NUVEM_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
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
    }
    catch (error) {
        console.error('Query error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new functions.https.HttpsError('internal', 'Failed to query invoice', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
    }
});
// Cancel invoice
export const cancelInvoice = functions.https.onCall(async (request) => {
    var _a, _b;
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required");
        }
        const { invoice_id, justificativa } = request.data;
        if (!invoice_id || !justificativa) {
            throw new functions.https.HttpsError("invalid-argument", "invoice_id and justificativa required");
        }
        if (justificativa.length < 15) {
            throw new functions.https.HttpsError("invalid-argument", "Justification must be at least 15 characters");
        }
        const invoiceDoc = await db.collection("invoices").doc(invoice_id).get();
        if (!invoiceDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Invoice not found");
        }
        const invoiceData = invoiceDoc.data();
        const nfeId = invoiceData === null || invoiceData === void 0 ? void 0 : invoiceData.nfe_id;
        // Cancel in NuvemFiscal
        const response = await axios.post(`${NUVEM_BASE_URL}v2/nfe/${nfeId}/cancelamento`, { justificativa }, {
            headers: {
                'Authorization': `Bearer ${NUVEM_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
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
    }
    catch (error) {
        console.error('Cancellation error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new functions.https.HttpsError('internal', 'Failed to cancel invoice', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
    }
});
//# sourceMappingURL=index.js.map