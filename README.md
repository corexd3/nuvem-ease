# Nuvem Ease - Invoice Management System

Production-ready system for managing Brazilian tax invoices (NF-e) through NuvemFiscal API and Firebase.

## ✅ What's Working

- **Issue NF-e**: Full integration with NuvemFiscal API to create product invoices
- **Query Invoices**: Check real-time status from NuvemFiscal
- **Cancel Invoices**: Cancel authorized invoices with proper justification
- **Authentication**: Secure Firebase Authentication
- **Cloud Functions**: 3 serverless functions for NuvemFiscal integration

## 🎯 Quick Start

```bash
# Install dependencies
npm install

# Configure environment (see .env.example)
cp .env.example .env.development

# Start development
npm run dev

# Build production
npm run build
```

## 📋 Required Environment Variables

Only these variables are needed in `.env.development`:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# NuvemFiscal API
NUVEMFISCAL_API_KEY=your_nuvemfiscal_api_key
```

## 🔥 Firebase Functions

### `issueNFe`
Creates NF-e in NuvemFiscal homologação environment

### `queryInvoice`
Retrieves invoice status from NuvemFiscal

### `cancelInvoice`
Cancels authorized invoice with justification

## 📁 Structure

```
├── app/
│   ├── issue/    # Issue NF-e (working)
│   ├── query/    # Query status (working)
│   └── cancel/   # Cancel invoice (working)
├── functions/
│   └── index.ts  # 3 Cloud Functions
└── src/
    └── components/forms/
        └── NFeFormSimple.tsx  # Minimal NF-e form
```

## 🗄️ Firestore Schema

### Collection: `invoices`
```javascript
{
  user_id: string,
  nfe_id: string,  // NuvemFiscal ID
  type: "nfe",
  status: string,
  emittente: { cpf_cnpj, razao_social, endereco },
  destinatario: { cpf_cnpj, razao_social, endereco },
  produtos: [{ codigo, descricao, ncm, cfop, quantidade, valor_unitario }],
  valor_total: number,
  created_at: timestamp
}
```

## 🎨 UI Notes

- **NF-e Tab**: Fully functional with NuvemFiscal API
- **NFC-e Tab**: UI placeholder only (no API integration)
- **NFS-e Tab**: UI placeholder only (no API integration)

## 📝 NF-e Minimal Required Fields

**Emittente (Your Company):**
- CNPJ, Inscrição Estadual, Razão Social
- Full address (street, number, district, city, state, ZIP)

**Destinatário (Customer):**
- CPF/CNPJ, Nome/Razão Social
- Full address

**Products:**
- Code, Description, NCM (8 digits), CFOP, Quantity, Unit Price

## 🧪 Testing NF-e in Sandbox

All invoices are created in **homologação** (test) environment. No real fiscal documents are generated.

### Quick Test with Mock Data

1. Navigate to **Issue Invoice** page
2. Click **"Fill Test Data (Sandbox)"** button at the top of the NF-e form
3. Form will auto-fill with valid test data:
   - Emittente: EMPRESA TESTE LTDA (test company)
   - Destinatário: João da Silva Santos (test customer)
   - Products: 2 sample products with valid NCM/CFOP codes
4. Click **"Issue NF-e"** to create test invoice
5. Copy the invoice ID from Firestore
6. Use **Query Invoice** page to check status
7. Use **Cancel Invoice** page to cancel with justification (min 15 chars)

### Test Data Details

Mock data is located in `src/utils/mockNFeData.ts`:
- Valid CNPJ/CPF formats for homologação
- Valid addresses in São Paulo
- Valid NCM codes (85171231, 84733090)
- Valid CFOP 5102 (sale within state)

## 🚀 Deployment

```bash
# Deploy Firebase Functions
cd functions
firebase deploy --only functions

# Build Next.js
npm run build

# Deploy to your hosting
```

## 📖 Documentation

- [NuvemFiscal API](https://dev.nuvemfiscal.com.br)
- [Firebase Functions](https://firebase.google.com/docs/functions)

## 🔒 Security

- All operations require Firebase Authentication
- API keys in environment variables only
- Functions validate user authorization

## 📄 License

MIT
