"use client";

import { NFEForm } from "@/components/NFEForm";

export default function NFEPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Issue NF-e</h1>
      <NFEForm />
    </div>
  );
}