"use server";

import { runAction } from "@/lib/run-action";
import { priceListService } from "@/modules/price-lists/services/price-list-service";
import type {
  CreatePriceListInput,
  PriceListItemInput,
  UpdatePriceListInput,
  UpdatePriceListItemInput,
} from "@/modules/price-lists/validation/price-list-schema";
import type { ActionResult } from "@/types/api";
import type { PriceList, PriceListDetail, PriceListItemWithProduct } from "@/types/price-list";

const LIST_PATH = "/masters/price-lists";

function editPath(id: string): string {
  return `/masters/price-lists/${id}/edit`;
}

export async function createPriceListAction(
  input: CreatePriceListInput
): Promise<ActionResult<PriceListDetail>> {
  return runAction(() => priceListService.createPriceList(input), [LIST_PATH]);
}

export async function updatePriceListAction(
  id: string,
  input: UpdatePriceListInput
): Promise<ActionResult<PriceListDetail>> {
  return runAction(() => priceListService.updatePriceList(id, input), [LIST_PATH, editPath(id)]);
}

export async function activatePriceListAction(id: string): Promise<ActionResult<PriceList>> {
  return runAction(() => priceListService.activatePriceList(id), [LIST_PATH]);
}

export async function deactivatePriceListAction(id: string): Promise<ActionResult<PriceList>> {
  return runAction(() => priceListService.deactivatePriceList(id), [LIST_PATH]);
}

export async function addPriceListItemAction(
  listId: string,
  input: PriceListItemInput
): Promise<ActionResult<PriceListItemWithProduct>> {
  return runAction(() => priceListService.addItem(listId, input), [editPath(listId)]);
}

export async function updatePriceListItemAction(
  listId: string,
  itemId: string,
  input: UpdatePriceListItemInput
): Promise<ActionResult<PriceListItemWithProduct>> {
  return runAction(() => priceListService.updateItem(listId, itemId, input), [editPath(listId)]);
}

export async function removePriceListItemAction(
  listId: string,
  itemId: string
): Promise<ActionResult<void>> {
  return runAction(() => priceListService.removeItem(listId, itemId), [editPath(listId)]);
}
