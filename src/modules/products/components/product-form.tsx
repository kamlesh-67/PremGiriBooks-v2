"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  createProductAction,
  updateProductAction,
} from "@/modules/products/actions/product-actions";
import { ProductClassificationSection } from "@/modules/products/components/product-classification-section";
import { ProductIdentitySection } from "@/modules/products/components/product-identity-section";
import { ProductPricingSection } from "@/modules/products/components/product-pricing-section";
import { ProductStockSection } from "@/modules/products/components/product-stock-section";
import { ProductTaxSection } from "@/modules/products/components/product-tax-section";
import type { ProductFormOptions } from "@/modules/products/utils/product-form-options";
import {
  createProductSchema,
  type CreateProductInput,
} from "@/modules/products/validation/product-schema";
import type { ProductWithRelations } from "@/types/product";

const LIST_PATH = "/masters/products";

interface ProductFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set — every Product field remains editable
   * while no stock exists (25-product-management.md) — so one component
   * serves both screens, mirroring warehouse-form.tsx. */
  product?: ProductWithRelations;
  /** The six pickers' options — active masters, plus (on edit) the product's
   * current references even if since deactivated (see
   * buildProductFormOptions). */
  options: ProductFormOptions;
}

export function ProductForm({ product, options }: ProductFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = product !== undefined;

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: product?.name ?? "",
      productCode: product?.productCode ?? "",
      barcode: product?.barcode ?? "",
      productType: product?.productType ?? "TRADING",
      categoryId: product?.categoryId ?? undefined,
      brandId: product?.brandId ?? undefined,
      unitId: product?.unitId ?? "",
      hsnCodeId: product?.hsnCodeId ?? undefined,
      gstRateId: product?.gstRateId ?? undefined,
      defaultWarehouseId: product?.defaultWarehouseId ?? undefined,
      marginProfileId: product?.marginProfileId ?? undefined,
      mrp: product?.mrp ?? undefined,
      sellingPrice: product?.sellingPrice ?? undefined,
      purchasePrice: product?.purchasePrice ?? undefined,
      minStockLevel: product?.minStockLevel ?? undefined,
      description: product?.description ?? "",
    },
  });

  // useWatch (not form.watch) — the subscription-based API React Compiler
  // can memoize safely (react-hooks/incompatible-library).
  const productType = useWatch({ control: form.control, name: "productType" });
  const unitId = useWatch({ control: form.control, name: "unitId" });
  const isService = productType === "SERVICE";

  // Goods (Trading/Expense) pick HSN-type codes, services pick SAC-type codes
  // (25-product-management.md; the server re-verifies the match).
  const hsnOptions = React.useMemo(
    () => options.hsnCodes.filter((hsnCode) => hsnCode.codeType === (isService ? "SAC" : "HSN")),
    [options.hsnCodes, isService]
  );

  // Switching the product type across the goods/services line invalidates a
  // selected code from the other family — clear it instead of submitting a
  // doomed value.
  React.useEffect(() => {
    const current = form.getValues("hsnCodeId");
    if (current && !hsnOptions.some((option) => option.id === current)) {
      form.setValue("hsnCodeId", undefined);
    }
  }, [form, hsnOptions]);

  const selectedUnit = options.units.find((unit) => unit.id === unitId);

  async function handleSubmit(data: CreateProductInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateProductAction(product.id, data)
        : await createProductAction(data);

      if (result.success) {
        toast.success(isEdit ? "Product saved successfully." : "Product created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(
        result.error ?? (isEdit ? "Failed to save product." : "Failed to create product.")
      );
    } catch {
      // A Server Action can reject outright (network drop, server crash) —
      // surface it instead of silently re-enabling the button (the
      // warehouse-form.tsx defensive convention).
      toast.error(isEdit ? "Failed to save product." : "Failed to create product.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-3xl flex-col gap-8">
        <ProductIdentitySection control={form.control} />

        <ProductClassificationSection
          control={form.control}
          categories={options.categories}
          brands={options.brands}
          units={options.units}
        />

        <ProductTaxSection
          control={form.control}
          hsnCodes={hsnOptions}
          gstRates={options.gstRates}
          isService={isService}
        />

        <ProductPricingSection control={form.control} marginProfiles={options.marginProfiles} />

        <ProductStockSection
          control={form.control}
          warehouses={options.warehouses}
          unitDecimalPlaces={selectedUnit?.decimalPlaces ?? 0}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(LIST_PATH)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
