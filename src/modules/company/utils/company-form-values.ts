import type { Company } from "@prisma/client";

import type { CompanyInput } from "@/modules/company/validation/company-schema";

export function toCompanyFormValues(company: Company): Partial<CompanyInput> {
  return {
    companyName: company.companyName,
    legalName: company.legalName,
    displayName: company.displayName ?? undefined,
    businessType: company.businessType ?? undefined,
    gstin: company.gstin ?? undefined,
    pan: company.pan ?? undefined,
    tan: company.tan ?? undefined,
    cin: company.cin ?? undefined,
    mobileNumber: company.mobileNumber ?? undefined,
    alternateMobile: company.alternateMobile ?? undefined,
    email: company.email ?? undefined,
    website: company.website ?? undefined,
    addressLine1: company.addressLine1 ?? undefined,
    addressLine2: company.addressLine2 ?? undefined,
    city: company.city ?? undefined,
    state: company.state ?? undefined,
    district: company.district ?? undefined,
    country: company.country,
    pinCode: company.pinCode ?? undefined,
    currency: company.currency,
    currencySymbol: company.currencySymbol,
    decimalPlaces: company.decimalPlaces,
    logo: company.logo ?? undefined,
  };
}
