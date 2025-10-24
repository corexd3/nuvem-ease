import * as functions from "firebase-functions/v2";
import admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import axios from 'axios';
import express from "express";
import cors from "cors";
import fs from 'fs';
import os from 'os';
admin.initializeApp();
const app = express();
const db = admin.firestore();
app.use(cors({ origin: ["http://localhost:3000", "https://kip-assistent.firebase.com"] }));
// Handle preflight requests explicitly
const nuvemBaseUrl = functions.config().nuvemfiscal?.base_url || process.env.NEXT_PUBLIC_NUVEMFISCAL_BASE_URL;
const nuvemApiKey = functions.config().nuvemfiscal?.api_key || process.env.NEXT_PUBLIC_NUVEMFISCAL_API_KEY;
// Configure certificates if needed
const tmp = os.tmpdir();
const pfxBase64 = functions.config().nuvemfiscal?.cert || process.env.CERT_PFX_PASSWORD;
if (pfxBase64) {
    const pfxPath = `${tmp}/cert.pfx`;
    fs.writeFileSync(pfxPath, Buffer.from(pfxBase64, 'base64'));
}
async function addMultipleDocs(collectionName, items) {
    const batch = db.batch();
    items.forEach(item => {
        const ref = db.collection(collectionName).doc();
        batch.set(ref, item);
    });
    await batch.commit();
}
app.post("/", async (req, res) => {
    try {
        // 1 Check user authentication from header (manual token check)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        // 2 Get invoice data
        const { invoiceData } = req.body;
        if (!invoiceData) {
            return res.status(400).json({ error: "Missing invoice data" });
        }
        // 3 Call NuvemFiscal API
        const response = await axios.post(nuvemBaseUrl + "nfce", invoiceData, {
            headers: {
                Authorization: `Bearer ${nuvemApiKey}`,
                "Content-Type": "application/json",
            },
        });
        // 4 Write invoice + items to Firestore in a batch
        const batch = db.batch();
        const invoiceRef = db.collection("invoices").doc();
        batch.set(invoiceRef, {
            user_id: uid,
            nfce_id: response.data.id,
            status: "processing",
            customer: invoiceData.customer,
            total_value: invoiceData.total,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        invoiceData.items.forEach((item) => {
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
        //  Respond with success
        return res.status(200).send({
            success: true,
            invoiceId: response.data.id,
        });
    }
    catch (error) {
        console.error("Error creating invoice:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating invoice",
            error: error.message,
        });
    }
});
export const createInvoice = onRequest({ region: "us-central1" }, app);
export const getInvoiceStatus = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }
        // Call external API to get invoice status
        const response = await axios.get(`${nuvemBaseUrl}nfce/${data.invoiceId}/status`, {
            headers: {
                'Authorization': `Bearer ${nuvemApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', 'Error fetching invoice status', error);
    }
});
export const cancelInvoice = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }
        // Call external API to cancel invoice
        const response = await axios.post(`${nuvemBaseUrl}nfce/${data.invoiceId}/cancel`, {}, {
            headers: {
                'Authorization': `Bearer ${nuvemApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', 'Error cancelling invoice', error);
    }
});
//# sourceMappingURL=index.js.map