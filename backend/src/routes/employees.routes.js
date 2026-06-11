import { Router } from 'express';

import { asyncHandler } from '../middleware/async-handler.js';
import { sendCreated, sendSuccess } from '../utils/http.js';
import {
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from '../services/employees.service.js';

export const employeesRouter = Router();

employeesRouter.get('/', asyncHandler((req, res) => {
  res.json(listEmployees());
}));

employeesRouter.post('/', asyncHandler((req, res) => {
  sendCreated(res, createEmployee(req.body));
}));

employeesRouter.get('/:id', asyncHandler((req, res) => {
  res.json(getEmployee(req.params.id));
}));

employeesRouter.put('/:id', asyncHandler((req, res) => {
  res.json(updateEmployee(req.params.id, req.body));
}));

employeesRouter.delete('/:id', asyncHandler((req, res) => {
  deleteEmployee(req.params.id);
  sendSuccess(res);
}));
