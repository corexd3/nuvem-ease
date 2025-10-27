"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CertificateService } from '@/services/nuvemfiscal';

interface Certificate {
  id: string;
  serial_number: string;
  issuer_name: string;
  not_after: string;
  not_before: string;
  subject_name: string;
}

export default function CertificatesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');

  const loadCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await CertificateService.listCertificates();
      setCertificates(response.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certificateFile) {
      toast({
        title: "Error",
        description: "Please select a certificate file",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await CertificateService.uploadCertificate(certificateFile, password);
      toast({
        title: "Success",
        description: "Certificate uploaded successfully",
      });
      setCertificateFile(null);
      setPassword('');
      loadCertificates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Digital Certificates</h1>

      <Card className="mb-6">
        <CardContent className="p-6">
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="certificate">Certificate File (PFX/P12)</Label>
              <Input
                id="certificate"
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Certificate Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Uploading...' : 'Upload Certificate'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial Number</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Valid Until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell>{cert.serial_number}</TableCell>
                  <TableCell>{cert.subject_name}</TableCell>
                  <TableCell>{cert.issuer_name}</TableCell>
                  <TableCell>{new Date(cert.not_after).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {certificates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No certificates found
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