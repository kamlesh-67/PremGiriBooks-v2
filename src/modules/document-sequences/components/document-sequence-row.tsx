"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import { updateDocumentSequenceAction } from "@/modules/document-sequences/actions/document-sequence-actions";
import {
  updateDocumentSequenceSchema,
  type UpdateDocumentSequenceInput,
} from "@/modules/document-sequences/validation/document-sequence-schema";
import type { DocumentSequenceListItem } from "@/types/document-sequence";

interface DocumentSequenceRowProps {
  sequence: DocumentSequenceListItem;
  canEdit: boolean;
}

function formatPreview(prefix: string, padding: number, nextNumber: number): string {
  return `${prefix}-${String(nextNumber).padStart(padding, "0")}`;
}

/**
 * A single document type's row, toggling between a read view and an inline
 * edit form — mirrors price-list-item-row.tsx's row-level Server Action
 * pattern. There is no "remove" action: every `DocumentType` always has a
 * row here, whether or not it has been used yet (34-document-number-engine.md's
 * Lazy row creation — editing a never-used type creates its row on save).
 */
export function DocumentSequenceRow({ sequence, canEdit }: DocumentSequenceRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<UpdateDocumentSequenceInput>({
    resolver: zodResolver(updateDocumentSequenceSchema),
    defaultValues: { prefix: sequence.prefix, padding: sequence.padding },
  });

  async function handleSave(data: UpdateDocumentSequenceInput) {
    setIsSaving(true);
    try {
      const result = await updateDocumentSequenceAction(sequence.documentType, data);
      if (result.success) {
        toast.success("Document numbering saved.");
        setIsEditing(false);
        router.refresh();
        return;
      }
      toast.error(result.error ?? "Failed to save document numbering.");
    } catch {
      toast.error("Failed to save document numbering.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <TableRow>
        <TableCell colSpan={5}>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSave)}
              className="flex flex-wrap items-end gap-3"
            >
              <span className="min-w-40 flex-1 text-sm font-medium text-foreground">
                {sequence.label}
              </span>
              <FormField
                control={form.control}
                name="prefix"
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormControl>
                      <Input placeholder="Prefix" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="padding"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={8}
                        step={1}
                        {...field}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="mb-[2px] flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => {
                    form.reset({ prefix: sequence.prefix, padding: sequence.padding });
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>
        <span className="font-medium text-foreground">{sequence.label}</span>
        {!sequence.isConfigured ? (
          <span className="ml-2 text-xs text-muted-foreground">(default)</span>
        ) : null}
      </TableCell>
      <TableCell>{sequence.prefix}</TableCell>
      <TableCell className="text-right font-financial">{sequence.padding}</TableCell>
      <TableCell className="text-right font-financial">
        {formatPreview(sequence.prefix, sequence.padding, sequence.nextNumber)}
      </TableCell>
      <TableCell className="text-right">
        {canEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${sequence.label} numbering`}
            onClick={() => setIsEditing(true)}
          >
            <Pencil size={16} />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
