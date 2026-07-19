"use server";

import { runAction } from "@/lib/run-action";
import { marginProfileService } from "@/modules/margin-profiles/services/margin-profile-service";
import type {
  CreateMarginProfileInput,
  UpdateMarginProfileInput,
} from "@/modules/margin-profiles/validation/margin-profile-schema";
import type { ActionResult } from "@/types/api";
import type { MarginProfile } from "@/types/margin-profile";

const LIST_PATH = "/masters/margin-profiles";

export async function createMarginProfileAction(
  input: CreateMarginProfileInput
): Promise<ActionResult<MarginProfile>> {
  return runAction(() => marginProfileService.createMarginProfile(input), [LIST_PATH]);
}

export async function updateMarginProfileAction(
  id: string,
  input: UpdateMarginProfileInput
): Promise<ActionResult<MarginProfile>> {
  return runAction(() => marginProfileService.updateMarginProfile(id, input), [
    LIST_PATH,
    `/masters/margin-profiles/${id}/edit`,
  ]);
}

export async function activateMarginProfileAction(
  id: string
): Promise<ActionResult<MarginProfile>> {
  return runAction(() => marginProfileService.activateMarginProfile(id), [LIST_PATH]);
}

export async function deactivateMarginProfileAction(
  id: string
): Promise<ActionResult<MarginProfile>> {
  return runAction(() => marginProfileService.deactivateMarginProfile(id), [LIST_PATH]);
}
