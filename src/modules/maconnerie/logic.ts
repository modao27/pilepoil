/** Logique du module maçonnerie (contrat `ModuleLogic`), chargée à la demande par le registre. */
import type { ModuleLogic } from '../types';
import type { MaconnerieResult, MaconnerieSpec } from './core/types';
import { reduce, type Action } from './state/actions';
import { createMaconnerieData, type MaconnerieData } from './state/model';
import { priceAction, shopping, summary } from './state/module';
import { toSpec } from './state/spec';

export const logic: ModuleLogic<MaconnerieData, MaconnerieSpec, MaconnerieResult, Action> = {
  create: () => createMaconnerieData(),
  reduce: (data, action) => reduce(data, action),
  toSpec,
  shopping,
  priceAction,
  summary,
};
