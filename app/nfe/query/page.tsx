"use client";

import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { NFeService } from '@/services/nuvemfiscal';
import { formatCurrency } from '@/lib/utils';

interface NFe {
    id: string;
    numero: string;
    status: string;
    valor_total: number;
    data_emissao: string;
}

export default function QueryNFePage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [nfeList, setNfeList] = useState<NFe[]>([]);
    const [filters, setFilters] = useState({
        dataInicial: '',
        dataFinal: '',
        status: ''
    });

    const loadNFes = async () => {
        setLoading(true);
        try {
            const params: any = {
                ambiente: process.env.NEXT_PUBLIC_NUVEMFISCAL_ENVIRONMENT
            };

            if (filters.status) {
                params.status = filters.status;
            }
            if (filters.dataInicial) {
                params.data_inicial = filters.dataInicial;
            }
            if (filters.dataFinal) {
                params.data_final = filters.dataFinal;
            }

            const response = await NFeService.listNFes(params);
            setNfeList(response.data || []);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
        setLoading(false);
    };

    useEffect(() => {
        loadNFes();
    }, []);

    const handleCancelNFe = async (id: string) => {
        if (!window.confirm('Are you sure you want to cancel this NF-e?')) {
            return;
        }

        setLoading(true);
        try {
            await NFeService.cancelNFe(id, 'Cancelled by user request');
            toast({
                title: "Success",
                description: "NF-e cancelled successfully",
            });
            loadNFes(); // Refresh the list
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
        setLoading(false);
    };

    if (loading) {
        return (<div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>);
    }
    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6">Query NF-e</h1>

            <Card className="mb-6">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Input
                                type="date"
                                placeholder="Initial Date"
                                value={filters.dataInicial}
                                onChange={(e) => setFilters(prev => ({ ...prev, dataInicial: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Input
                                type="date"
                                placeholder="Final Date"
                                value={filters.dataFinal}
                                onChange={(e) => setFilters(prev => ({ ...prev, dataFinal: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Input
                                placeholder="Status"
                                value={filters.status}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            />
                        </div>
                    </div>
                    <Button
                        className="mt-4 w-full"
                        onClick={loadNFes}
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Search'}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Number</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Issue Date</TableHead>
                                <TableHead>Total Value</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {nfeList.map((nfe) => (
                                <TableRow key={nfe.id}>
                                    <TableCell>{nfe.numero}</TableCell>
                                    <TableCell>{nfe.status}</TableCell>
                                    <TableCell>{new Date(nfe.data_emissao).toLocaleDateString()}</TableCell>
                                    <TableCell>{formatCurrency(nfe.valor_total)}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleCancelNFe(nfe.id)}
                                            disabled={nfe.status !== 'authorized' || loading}
                                        >
                                            Cancel
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {nfeList.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">
                                        No NF-e found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}