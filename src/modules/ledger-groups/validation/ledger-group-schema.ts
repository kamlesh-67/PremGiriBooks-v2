import { z } from "zod";

const ACCOUNT_NATURES = ["ASSET", "LIABILITY", "INCOME", "EXPENSE"] as const;

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

const REMARKS_SCHEMA = z.string().trim().max(500, "Remarks must be at most 500 characters").optional();

// A sub-group (parentGroupId present) always inherits its parent's
// natureType/affectsGrossProfit — the server derives these from the parent
// and must never trust a client-supplied value for them, so the schema
// rejects the fields outright rather than silently ignoring them.
export const createLedgerGroupSchema = z
  .object({
    name: NAME_SCHEMA,
    parentGroupId: z.uuid().optional(),
    natureType: z.enum(ACCOUNT_NATURES).optional(),
    affectsGrossProfit: z.boolean().optional(),
    remarks: REMARKS_SCHEMA,
  })
  .superRefine((data, ctx) => {
    if (data.parentGroupId) {
      if (data.natureType !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["natureType"],
          message: "Nature is inherited from the parent group and cannot be set for a sub-group.",
        });
      }
      if (data.affectsGrossProfit !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["affectsGrossProfit"],
          message:
            "Affects Gross Profit is inherited from the parent group and cannot be set for a sub-group.",
        });
      }
      return;
    }

    if (!data.natureType) {
      ctx.addIssue({
        code: "custom",
        path: ["natureType"],
        message: "Nature is required for a top-level group.",
      });
      return;
    }

    if (
      data.affectsGrossProfit === true &&
      (data.natureType === "ASSET" || data.natureType === "LIABILITY")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["affectsGrossProfit"],
        message: "Affects Gross Profit only applies to Income or Expense groups.",
      });
    }
  });

export type CreateLedgerGroupInput = z.infer<typeof createLedgerGroupSchema>;

// Edit only ever changes name and remarks — parentGroupId/natureType/
// affectsGrossProfit are immutable once a group is created.
export const updateLedgerGroupSchema = z.object({
  name: NAME_SCHEMA,
  remarks: REMARKS_SCHEMA,
});

export type UpdateLedgerGroupInput = z.infer<typeof updateLedgerGroupSchema>;
