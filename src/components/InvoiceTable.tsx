import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { format } from "date-fns";

interface Invoice {
  id: string;
  numero: string;
  customer_name: string | null;
  total_value: number;
  status: string;
  issued_at: string | null | undefined;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  onViewDetails?: (invoice: Invoice) => void;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  authorized: "default",
  cancelled: "destructive",
  rejected: "destructive",
  processing: "secondary",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  authorized: "Autorizada",
  cancelled: "Cancelada",
  rejected: "Rejeitada",
  processing: "Processando",
};

export function InvoiceTable({ invoices, onViewDetails }: InvoiceTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhuma nota fiscal encontrada
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.numero}</TableCell>
                <TableCell>{invoice.customer_name || "—"}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(Number(invoice.total_value))}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariants[invoice.status] || "default"}>
                    {statusLabels[invoice.status] || invoice.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {invoice.issued_at && !isNaN(new Date(invoice.issued_at).getTime())
                    ? format(new Date(invoice.issued_at), "dd/MM/yyyy HH:mm")
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails?.(invoice)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
