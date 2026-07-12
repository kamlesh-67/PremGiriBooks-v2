"use client";

import * as React from "react";
import NextImage from "next/image";
import { Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  LOGO_ACCEPT_ATTRIBUTE,
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_FILE_SIZE_BYTES,
} from "@/constants/company";
import { uploadCompanyLogoAction } from "@/modules/company/actions/company-actions";

interface LogoUploadProps {
  value: string | null;
  onChange: (path: string | null) => void;
  disabled?: boolean;
}

function validateFile(file: File): string | null {
  if (!LOGO_ALLOWED_MIME_TYPES.includes(file.type as (typeof LOGO_ALLOWED_MIME_TYPES)[number])) {
    return "Logo must be a PNG, JPG, JPEG, or SVG file.";
  }

  if (file.size > LOGO_MAX_FILE_SIZE_BYTES) {
    return "Logo must be smaller than 5 MB.";
  }

  return null;
}

export function LogoUpload({ value, onChange, disabled }: LogoUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("logo", file);
    const result = await uploadCompanyLogoAction(formData);

    if (result.success && result.data) {
      onChange(result.data.path);
    } else {
      setError(result.error ?? "Logo upload failed.");
    }

    setIsUploading(false);
  }

  return (
    <div className="flex items-center gap-4">
      {value ? (
        <NextImage
          src={value}
          alt="Company logo"
          width={64}
          height={64}
          className="h-16 w-16 rounded-lg border border-border bg-surface object-contain"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
          <ImageIcon size={24} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_ACCEPT_ATTRIBUTE}
          onChange={handleFileChange}
          disabled={disabled || isUploading}
          className="hidden"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? "Uploading…" : "Upload logo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, JPEG or SVG. Max 5 MB.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
