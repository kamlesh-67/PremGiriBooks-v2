"use server";

import { runAction } from "@/lib/run-action";
import { hsnCodeService } from "@/modules/hsn-codes/services/hsn-code-service";
import type {
  CreateHsnCodeInput,
  UpdateHsnCodeInput,
} from "@/modules/hsn-codes/validation/hsn-code-schema";
import type { ActionResult } from "@/types/api";
import type { HsnCode } from "@/types/hsn-code";

const LIST_PATH = "/masters/hsn-codes";

export async function createHsnCodeAction(
  input: CreateHsnCodeInput
): Promise<ActionResult<HsnCode>> {
  return runAction(() => hsnCodeService.createHsnCode(input), [LIST_PATH]);
}

export async function updateHsnCodeAction(
  id: string,
  input: UpdateHsnCodeInput
): Promise<ActionResult<HsnCode>> {
  return runAction(() => hsnCodeService.updateHsnCode(id, input), [
    LIST_PATH,
    `/masters/hsn-codes/${id}/edit`,
  ]);
}

export async function activateHsnCodeAction(id: string): Promise<ActionResult<HsnCode>> {
  return runAction(() => hsnCodeService.activateHsnCode(id), [LIST_PATH]);
}

export async function deactivateHsnCodeAction(id: string): Promise<ActionResult<HsnCode>> {
  return runAction(() => hsnCodeService.deactivateHsnCode(id), [LIST_PATH]);
}
