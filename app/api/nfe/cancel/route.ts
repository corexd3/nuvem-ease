import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getAuth, getFirestore } from '@/lib/firebase-admin';
import admin from 'firebase-admin';

const NUVEM_API_KEY = process.env.NUVEMFISCAL_API_KEY || "";
const NUVEM_BASE_URL = "https://api.nuvemfiscal.com.br/";

export async function POST(request: NextRequest) {
  try {
    // Get the authorization token from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify the Firebase ID token
    try {
      const auth = getAuth();
      await auth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { invoice_id, justificativa } = await request.json();

    if (!invoice_id || !justificativa) {
      return NextResponse.json(
        { error: 'invoice_id and justificativa required' },
        { status: 400 }
      );
    }

    if (justificativa.length < 15) {
      return NextResponse.json(
        { error: 'Justification must be at least 15 characters' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const invoiceDoc = await db.collection("invoices").doc(invoice_id).get();

    if (!invoiceDoc.exists) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const invoiceData = invoiceDoc.data();
    const nfeId = invoiceData?.nfe_id;

    // Cancel in NuvemFiscal
    const response = await axios.post(
      `${NUVEM_BASE_URL}v2/nfe/${nfeId}/cancelamento`,
      { justificativa },
      {
        headers: {
          'Authorization': `Bearer ${NUVEM_API_KEY}`,
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

    return NextResponse.json({
      success: true,
      data: response.data
    });

  } catch (error: any) {
    console.error('Cancellation error:', error.response?.data || error.message);
    return NextResponse.json(
      {
        error: 'Failed to cancel invoice',
        details: error.response?.data || error.message
      },
      { status: 500 }
    );
  }
}
