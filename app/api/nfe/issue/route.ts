import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getAuth, getFirestore } from '@/lib/firebase-admin';
import admin from 'firebase-admin';

const NUVEM_API_KEY = process.env.NUVEMFISCAL_API_KEY || "";
const NUVEM_BASE_URL = "https://sandbox-api.nuvemfiscal.com.br/";

export async function POST(request: NextRequest) {
  try {

    // Get the authorization token from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[API] No authorization header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify the Firebase ID token
    let decodedToken;
    try {
      const auth = getAuth();
      decodedToken = await auth.verifyIdToken(token);
    } catch (error: any) {
      console.error('[API] Token verification error:', error.message);
      return NextResponse.json(
        { error: 'Invalid token', details: error.message },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;
    const data = await request.json();

    // Validate required fields
    if (!data?.emittente?.cpf_cnpj || !data?.destinatario || !data?.produtos) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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
      itens: data.produtos.map((item: any, index: number) => ({
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

    const result = await axios.post(
      `${NUVEM_BASE_URL}v2/nfe`,
      nfePayload,
      {
        headers: {
          'Authorization': `Bearer ${NUVEM_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Save to Firestore
    const db = getFirestore();
    const invoiceRef = db.collection("invoices").doc();
    await invoiceRef.set({
      user_id: uid,
      nfe_id: result.data.id,
      type: "nfe",
      status: result.data.status || "processing",
      emittente: data.emittente,
      destinatario: data.destinatario,
      produtos: data.produtos,
      valor_total: data.produtos.reduce((sum: number, p: any) => sum + p.valor_total, 0),
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      invoice_id: invoiceRef.id,
      nfe_id: result.data.id,
      data: result.data
    });

  } catch (error: any) {
    console.error('NF-e creation error:', error.response?.data || error.message);
    return NextResponse.json(
      {
        error: 'Failed to issue NF-e',
        details: error.response?.data || error.message
      },
      { status: 500 }
    );
  }
}
