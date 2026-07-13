"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LedgerGroupSelector } from "@/modules/ledger-groups/components/ledger-group-selector";
import {
  BANK_ACCOUNT_TYPES,
  BANK_ACCOUNT_TYPE_LABELS,
  createBankAccountSchema,
  type CreateBankAccountInput,
} from "@/modules/bank-accounts/validation/bank-account-schema";
import type { ActionResult } from "@/types/api";
import type { BankAccountWithLedger } from "@/types/bank-account";
import type { LedgerGroup } from "@/types/ledger-group";

interface BankAccountFormProps {
  groups: LedgerGroup[];
  onSubmit: (data: CreateBankAccountInput) => Promise<ActionResult<BankAccountWithLedger>>;
}

// Per 15-bank-management.md: "If the company has created no custom
// sub-groups under 'Bank Accounts', the group is simply 'Bank Accounts'
// itself with no picker shown." Only when the company has created custom
// sub-groups (groups.length > 1) does this render an actual selector.
export function BankAccountForm({ groups, onSubmit }: BankAccountFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const singleGroup = groups.length === 1 ? groups[0] : null;

  const form = useForm<CreateBankAccountInput>({
    resolver: zodResolver(createBankAccountSchema),
    defaultValues: {
      accountDisplayName: "",
      ledgerGroupId: singleGroup?.id ?? "",
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      branchName: "",
      accountHolderName: "",
      accountType: "CURRENT",
      openingBalance: 0,
      openingBalanceType: "DEBIT",
    },
  });

  async function handleSubmit(data: CreateBankAccountInput) {
    setIsSubmitting(true);
    const result = await onSubmit(data);
    setIsSubmitting(false);

    if (result.success) {
      toast.success("Bank account created successfully.");
      router.push("/accounting/banks");
      router.refresh();
      return;
    }

    toast.error(result.error ?? "Failed to create bank account.");
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        No &quot;Bank Accounts&quot; ledger group was found for this company. Contact your
        administrator before creating a bank account.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-2xl flex-col gap-6">
        <FormField
          control={form.control}
          name="ledgerGroupId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ledger Group *</FormLabel>
              {singleGroup ? (
                <p className="text-sm text-muted-foreground">{singleGroup.name}</p>
              ) : (
                <LedgerGroupSelector
                  groups={groups}
                  value={field.value || undefined}
                  onChange={(groupId) => field.onChange(groupId ?? "")}
                  allowNone={false}
                  placeholder="Select a ledger group"
                />
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accountDisplayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Display Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. HDFC Bank - 1234" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="bankName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bank Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="accountHolderName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Holder Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="accountNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Number *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ifscCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IFSC Code *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. HDFC0001234" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="branchName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="accountType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Type *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BANK_ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {BANK_ACCOUNT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="upiId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>UPI ID</FormLabel>
              <FormControl>
                <Input placeholder="e.g. business@upi" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="openingBalance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opening Balance</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    {...field}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="openingBalanceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opening Balance Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="DEBIT">Debit</SelectItem>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/accounting/banks")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Create Bank Account"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
