"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  activateBankAccountAction,
  deactivateBankAccountAction,
} from "@/modules/bank-accounts/actions/bank-account-actions";
import { BankAccountStatusBadge } from "@/modules/bank-accounts/components/bank-account-status-badge";
import { BANK_ACCOUNT_TYPE_LABELS } from "@/modules/bank-accounts/validation/bank-account-schema";
import type { BankAccountWithLedger } from "@/types/bank-account";

interface BankAccountTableProps {
  bankAccounts: BankAccountWithLedger[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function BankAccountTable({
  bankAccounts,
  canEdit = false,
  canManage = false,
}: BankAccountTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleToggleActive(bankAccount: BankAccountWithLedger) {
    setPendingId(bankAccount.id);
    const action = bankAccount.isActive ? deactivateBankAccountAction : activateBankAccountAction;

    try {
      const result = await action(bankAccount.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update bank account status.");
        return;
      }
      toast.success(bankAccount.isActive ? "Bank account deactivated." : "Bank account activated.");
    } catch {
      toast.error("Failed to update bank account status.");
    } finally {
      setPendingId(null);
    }
  }

  if (bankAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No bank accounts found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead>Account Number</TableHead>
          <TableHead>IFSC</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Opening Balance</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bankAccounts.map((bankAccount) => (
          <TableRow key={bankAccount.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{bankAccount.ledger.name}</span>
                <span className="text-xs text-muted-foreground">{bankAccount.bankName}</span>
              </div>
            </TableCell>
            <TableCell>{bankAccount.accountNumber}</TableCell>
            <TableCell>{bankAccount.ifscCode}</TableCell>
            <TableCell>{BANK_ACCOUNT_TYPE_LABELS[bankAccount.accountType]}</TableCell>
            <TableCell className="text-right font-financial">
              {bankAccount.ledger.openingBalance.toFixed(2)}{" "}
              {bankAccount.ledger.openingBalanceType === "DEBIT" ? "Dr" : "Cr"}
            </TableCell>
            <TableCell>
              <BankAccountStatusBadge isActive={bankAccount.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/accounting/banks/${bankAccount.id}/edit`}
                        aria-label="Edit bank account"
                      >
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId === bankAccount.id}
                    onClick={() => handleToggleActive(bankAccount)}
                  >
                    {bankAccount.isActive ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
