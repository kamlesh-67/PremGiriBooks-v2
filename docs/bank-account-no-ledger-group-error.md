# Error: "No 'Bank Accounts' ledger group was found for this company"

## Where it appears

**Accounting → Bank Management → New (Create Bank Account)**

```
No "Bank Accounts" ledger group was found for this company. Contact your
administrator before creating a bank account.
```

Source: [src/modules/bank-accounts/components/bank-account-form.tsx:82-89](../src/modules/bank-accounts/components/bank-account-form.tsx#L82-L89)

## What triggers it

The Create Bank Account form only renders its fields when the server has
resolved at least one active ledger group under (or equal to) the reserved
**"Bank Accounts"** group for the current company:

- [bank-account-service.ts:65-72](../src/modules/bank-accounts/services/bank-account-service.ts#L65-L72)
  (`listSelectableLedgerGroupsForBankAccount`) queries the company's ledger
  groups and filters them down to the "Bank Accounts" subtree via
  `getBankAccountsSubtreeIds`.
- [excluded-groups.ts:14-17](../src/modules/ledgers/utils/excluded-groups.ts#L14-L17)
  explicitly documents that this resolves to an **empty set** — no error
  thrown — when the company's chart of accounts has no "Bank Accounts" group
  at all.

If that list comes back empty, `groups.length === 0` and the form shows the
dashed placeholder box above instead of the create form.

## Root cause

Every company is supposed to be seeded with a standard chart-of-accounts
skeleton (`DEFAULT_LEDGER_GROUPS`, including "Bank Accounts" under "Current
Assets") the moment it is created. That seeding is implemented in
[company-service.ts:53-63](../src/modules/company/services/company-service.ts#L53-L63):

```ts
async createCompany(input: CompanyInput): Promise<CompanyWithSettings> {
  await assertAdministrator();
  const data = normalizeCompanyInput(companySchema.parse(input));

  return prisma.$transaction(async (tx) => {
    const company = await companyRepository.create(data, tx);
    await ledgerGroupService.seedDefaultGroups(company.id, tx); // <-- seeds "Bank Accounts", etc.
    await ledgerService.seedDefaultLedger(company.id, tx);
    return company;
  });
},
```

However, the **bootstrap "Default Company"** created by `prisma/seed.ts` does
**not** go through `companyService.createCompany()`. It calls
`tx.company.create()` directly:

[prisma/seed.ts:61-80](../prisma/seed.ts#L61-L80)

```ts
await prisma.$transaction(async (tx) => {
  const company = await tx.company.create({
    data: {
      companyName: "Default Company",
      legalName: "Default Company",
      settings: { create: {} },
    },
  });

  await tx.user.create({ /* admin user */ });
});
```

This path never calls `ledgerGroupService.seedDefaultGroups()` or
`ledgerService.seedDefaultLedger()`. The result: "Default Company" (and any
other company created the same way, e.g. via a raw DB insert or an older/ad
hoc script) has **zero ledger groups** — not just missing "Bank Accounts",
but missing the entire chart of accounts.

**In short:** the seed script and the application's own company-creation
service disagree on what a "complete" company looks like, and the seed
script is the one that's incomplete.

## How to fix it

### Option A — Quick fix: seed the missing groups for the existing company

Run a one-off script against the affected company (replace the id lookup if
you have more than one company, or already know the id):

**Note:** an earlier version of this script aborted whenever the company had *any* existing
`LedgerGroup` rows at all (`existingGroups > 0`), on the theory that `seedDefaults()` isn't
idempotent. That refuses to fix the exact case described above in "Root cause" — a company with
some custom groups (e.g. `Purchase`, `Test`, `Test2`) but none of the 23 reserved defaults, since
it can't distinguish "already fully seeded" from "partially populated, still missing Bank
Accounts." The version below reconciles by **name** instead: it reads the company's existing
`LedgerGroup` names into a set and creates only the `DEFAULT_LEDGER_GROUPS` entries not already
present, in two passes (parents, then children) matching `ledgerGroupRepository.seedDefaults()`'s
own ordering, and only creates the default "Cash" ledger if one doesn't already exist by name.

```ts
// scripts/seed-missing-ledger-groups.ts
import { prisma } from "../src/lib/prisma";
import { DEFAULT_LEDGER_GROUPS } from "../src/modules/ledger-groups/constants/default-groups";

async function main() {
  const company = await prisma.company.findFirstOrThrow({
    where: { companyName: "Default Company" },
  });

  await prisma.$transaction(async (tx) => {
    const existing = await tx.ledgerGroup.findMany({
      where: { companyId: company.id },
      select: { id: true, name: true },
    });
    const idByName = new Map(existing.map((group) => [group.name, group.id]));

    // Pass 1 — top-level groups (parent: null). Every DEFAULT_LEDGER_GROUPS
    // child references a top-level group's name, so parents must exist first.
    for (const seed of DEFAULT_LEDGER_GROUPS.filter((g) => g.parent === null)) {
      if (idByName.has(seed.name)) continue;
      const created = await tx.ledgerGroup.create({
        data: {
          companyId: company.id,
          name: seed.name,
          parentGroupId: null,
          natureType: seed.nature,
          affectsGrossProfit: seed.affectsGrossProfit,
          isSystemDefined: true,
        },
      });
      idByName.set(seed.name, created.id);
    }

    // Pass 2 — child groups.
    for (const seed of DEFAULT_LEDGER_GROUPS.filter((g) => g.parent !== null)) {
      if (idByName.has(seed.name)) continue;
      const parentId = idByName.get(seed.parent as string);
      if (!parentId) {
        throw new Error(`Seed data error: parent group "${seed.parent}" was not found.`);
      }
      const created = await tx.ledgerGroup.create({
        data: {
          companyId: company.id,
          name: seed.name,
          parentGroupId: parentId,
          natureType: seed.nature,
          affectsGrossProfit: seed.affectsGrossProfit,
          isSystemDefined: true,
        },
      });
      idByName.set(seed.name, created.id);
    }

    // Default "Cash" ledger — only create it if one doesn't already exist by name.
    const cashLedgerExists = await tx.ledger.findFirst({
      where: { companyId: company.id, name: "Cash" },
      select: { id: true },
    });
    if (!cashLedgerExists) {
      const cashInHandId = idByName.get("Cash-in-Hand");
      if (!cashInHandId) {
        throw new Error('Seed data error: "Cash-in-Hand" group was not found for the Cash ledger.');
      }
      await tx.ledger.create({
        data: {
          companyId: company.id,
          ledgerGroupId: cashInHandId,
          name: "Cash",
          openingBalance: 0,
          openingBalanceType: "DEBIT",
          isSystemDefined: true,
        },
      });
    }
  });

  console.log(`Reconciled default ledger groups + Cash ledger for ${company.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

Run it with:

```bash
npx tsx scripts/seed-missing-ledger-groups.ts
```

> ⚠️ `ledgerGroupService.seedDefaultGroups` uses plain `create` calls, not
> `upsert` ([ledger-group-repository.ts:169-204](../src/modules/ledger-groups/repositories/ledger-group-repository.ts#L169-L204)).
> It is **not safe to run twice** on the same company — it will create
> duplicate groups. The count check above guards against that. Delete the
> script after use; it's a one-time migration aid, not part of the app.

After running it, reload **Accounting → Bank Management → New** — the
"Bank Accounts" group (and its siblings) will now exist and the form will
render normally.

### Option B — Permanent fix: make the seed script consistent with `createCompany`

Update `prisma/seed.ts` to seed the chart of accounts the same way
`companyService.createCompany()` does, so this can't happen again for any
freshly-bootstrapped environment:

```ts
// prisma/seed.ts
import { ledgerGroupService } from "../src/modules/ledger-groups/services/ledger-group-service";
import { ledgerService } from "../src/modules/ledgers/services/ledger-service";

// ...inside the existing transaction, after tx.company.create(...):
const company = await tx.company.create({ /* ...unchanged... */ });

await ledgerGroupService.seedDefaultGroups(company.id, tx);
await ledgerService.seedDefaultLedger(company.id, tx);

await tx.user.create({ /* ...unchanged... */ });
```

This keeps "a company must never exist with an incomplete chart of
accounts" (the invariant `company-service.ts` already documents) true for
**every** code path that creates a company, not just the in-app one.

### Preventing this class of bug going forward

- `companyRepository.create()` should ideally be the only supported way to
  insert a `Company` row exercised by application code paths outside of
  `companyService.createCompany()` — but since Prisma can't enforce
  "always seed X after inserting Y," add a regression test that asserts
  every company returned by `prisma.company.findMany()` has at least one
  `LedgerGroup` row, and run it as part of seed/migration verification.
- Consider adding an idempotent guard (e.g. `count > 0 ? skip : seed`)
  inside `ledgerGroupService.seedDefaultGroups` itself, so accidentally
  calling it twice — from a script, a retry, etc. — fails safe instead of
  duplicating the chart of accounts.

## Why the app didn't throw a harder error

This is a deliberate design choice, not a bug in the empty-set path itself:
[excluded-groups.ts:14-17](../src/modules/ledgers/utils/excluded-groups.ts#L14-L17)
documents that a company chart of accounts legitimately *could* not have a
"Bank Accounts" subtree (e.g. mid-setup), so the resolver returns an empty
set rather than throwing. The form then shows the "contact your
administrator" message instead of crashing. The bug is upstream: the
seed script leaving companies in that state in the first place.
