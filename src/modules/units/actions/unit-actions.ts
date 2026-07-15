"use server";

import { runAction } from "@/lib/run-action";
import { unitService } from "@/modules/units/services/unit-service";
import type { CreateUnitInput, UpdateUnitInput } from "@/modules/units/validation/unit-schema";
import type { ActionResult } from "@/types/api";
import type { Unit } from "@/types/unit";

const LIST_PATH = "/masters/units";

export async function createUnitAction(input: CreateUnitInput): Promise<ActionResult<Unit>> {
  return runAction(() => unitService.createUnit(input), [LIST_PATH]);
}

export async function updateUnitAction(
  id: string,
  input: UpdateUnitInput
): Promise<ActionResult<Unit>> {
  return runAction(() => unitService.updateUnit(id, input), [
    LIST_PATH,
    `/masters/units/${id}/edit`,
  ]);
}

export async function activateUnitAction(id: string): Promise<ActionResult<Unit>> {
  return runAction(() => unitService.activateUnit(id), [LIST_PATH]);
}

export async function deactivateUnitAction(id: string): Promise<ActionResult<Unit>> {
  return runAction(() => unitService.deactivateUnit(id), [LIST_PATH]);
}
