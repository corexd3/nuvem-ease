import { Timestamp } from 'firebase/firestore';

export type InvoiceStatus = 'pending' | 'authorized' | 'cancelled' | 'rejected' | 'processing';
export type PaymentMethod = 'money' | 'credit_card' | 'debit_card' | 'pix' | 'other';

export interface Profile {
  id: string;
  cnpj: string;
  company_name: string;
  email: string | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
}

export interface Invoice {
  id: string;
  user_id: string;
  numero: string;
  serie: string | null;
  customer_cpf_cnpj: string | null;
  customer_name: string | null;
  customer_email: string | null;
  payment_method: PaymentMethod | null;
  total_value: number;
  discount_value: number | null;
  status: InvoiceStatus | null;
  chave_acesso: string | null;
  authorization_protocol: string | null;
  nuvemfiscal_id: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  cancellation_reason: string | null;
  issued_at: Timestamp | null;
  cancelled_at: Timestamp | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_code: string | null;
  product_name: string;
  ncm: string | null;
  cfop: string | null;
  quantity: number;
  unit_value: number;
  total_value: number;
  created_at: Timestamp | null;
}
