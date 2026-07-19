import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocumentSequenceRow } from "@/modules/document-sequences/components/document-sequence-row";
import type { DocumentSequenceListItem } from "@/types/document-sequence";

interface DocumentSequenceTableProps {
  sequences: DocumentSequenceListItem[];
  canEdit: boolean;
}

export function DocumentSequenceTable({ sequences, canEdit }: DocumentSequenceTableProps) {
  if (sequences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No document types found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Document Type</TableHead>
          <TableHead>Prefix</TableHead>
          <TableHead className="text-right">Padding</TableHead>
          <TableHead className="text-right">Preview</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sequences.map((sequence) => (
          <DocumentSequenceRow key={sequence.documentType} sequence={sequence} canEdit={canEdit} />
        ))}
      </TableBody>
    </Table>
  );
}
