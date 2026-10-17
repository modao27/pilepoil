/** Logique du module maçonnerie (contrat `ModuleLogic`), chargée à la demande par le registre. */
import type { ModuleLogic } from '../types';
import type { MaconnerieResult, MaconnerieSpec } from './core/compute';
import { reduce, type Action } from './state/actions';
import { createMaconnerieData, type MaconnerieData } from './state/model';
import { toSpec } from './state/spec';

export const logic: ModuleLogic<MaconnerieData, MaconnerieSpec, MaconnerieResult, Action> = {
  create: () => createMaconnerieData(),
  reduce: (data, action) => reduce(data, action),
  toSpec,
  shopping: () => [],
  priceAction: (key, value) => ({ type: 'maconnerie/price', key, value }),
  summary: (r) => ({ text: 'Maçonnerie', alerts: r.alerts.length }),
};
