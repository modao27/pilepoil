/** Logique du module cloisons (contrat `ModuleLogic`), chargée à la demande par le registre. */
import type { ModuleLogic } from '../types';
import type { CloisonsResult, CloisonsSpec } from './core/types';
import { reduce, type Action } from './state/actions';
import type { CloisonsData } from './state/model';
import { create, priceAction, shopping, summary, toSpec } from './state/module';

export const logic: ModuleLogic<CloisonsData, CloisonsSpec, CloisonsResult, Action> = {
  create,
  reduce: (data, action) => reduce(data, action),
  toSpec,
  shopping,
  priceAction,
  summary,
};
