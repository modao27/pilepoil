/** Logique du module parquet (contrat `ModuleLogic`), chargée à la demande par le registre. */
import type { ModuleLogic } from '../types';
import type { ParquetResult, ParquetSpec } from './core/types';
import { reduce, type Action } from './state/actions';
import type { ParquetData } from './state/model';
import { create, createPose, priceAction, shopping, summary, toSpec } from './state/module';

export const logic: ModuleLogic<ParquetData, ParquetSpec, ParquetResult, Action> = {
  create,
  createPose,
  reduce: (data, action) => reduce(data, action),
  toSpec,
  shopping,
  priceAction,
  summary,
};
