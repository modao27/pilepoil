/** Logique du module carrelage (contrat `ModuleLogic`), chargée à la demande par le registre. */
import type { ModuleLogic } from '../types';
import type { ProjectResult, ProjectSpec } from './core';
import { reduce, type Action } from './state/actions';
import type { CarrelageData } from './state/data';
import { create, createPose, priceAction, shopping, summary, toSpec, wallBases } from './state/module';

export const logic: ModuleLogic<CarrelageData, ProjectSpec, ProjectResult, Action> = {
  create,
  createPose,
  reduce: (data, action) => reduce(data, action),
  toSpec,
  shopping,
  priceAction,
  summary,
  wallBases,
};
