/** Logique du module peinture (contrat `ModuleLogic`), chargée à la demande par le registre. */
import type { ModuleLogic } from '../types';
import type { PeintureResult, PeintureSpec } from './core/types';
import { reduce, type Action } from './state/actions';
import type { PeintureData } from './state/model';
import { create, createPose, priceAction, shopping, summary, toSpec } from './state/module';

export const logic: ModuleLogic<PeintureData, PeintureSpec, PeintureResult, Action> = {
  create,
  createPose,
  reduce: (data, action) => reduce(data, action),
  toSpec,
  shopping,
  priceAction,
  summary,
};
