import { Router } from 'express';

import {
  createClient,
  createContract,
  createEmployee,
  deleteClient,
  deleteContract,
  deleteEmployee,
  getClientById,
  getContractById,
  getEmployeeById,
  listClients,
  listContracts,
  listEmployees,
  updateClient,
  updateContract,
  updateEmployee,
} from '../services/directories.service.js';

function parseId(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ message: 'Некорректный идентификатор записи.' });
    return null;
  }

  return id;
}

function sendMutationError(res, error) {
  let message = error.message || 'Не удалось выполнить операцию.';
  const status = message.startsWith('Нельзя удалить') ? 409 : 400;

  if (message.toLowerCase().includes('unique constraint')) {
    message = 'Запись с такими уникальными данными уже существует.';
  }

  res.status(status).json({ message });
}

function createCrudRouter({ createItem, deleteItem, getItem, listItems, notFoundMessage, updateItem }) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ items: listItems() });
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req, res);

    if (!id) {
      return;
    }

    const item = getItem(id);

    if (!item) {
      res.status(404).json({ message: notFoundMessage });
      return;
    }

    res.json(item);
  });

  router.post('/', (req, res) => {
    try {
      res.status(201).json(createItem(req.body || {}));
    } catch (error) {
      sendMutationError(res, error);
    }
  });

  router.put('/:id', (req, res) => {
    const id = parseId(req, res);

    if (!id) {
      return;
    }

    try {
      const item = updateItem(id, req.body || {});

      if (!item) {
        res.status(404).json({ message: notFoundMessage });
        return;
      }

      res.json(item);
    } catch (error) {
      sendMutationError(res, error);
    }
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req, res);

    if (!id) {
      return;
    }

    try {
      const deleted = deleteItem(id);

      if (!deleted) {
        res.status(404).json({ message: notFoundMessage });
        return;
      }

      res.status(204).send();
    } catch (error) {
      sendMutationError(res, error);
    }
  });

  return router;
}

export const clientsRouter = createCrudRouter({
  createItem: createClient,
  deleteItem: deleteClient,
  getItem: getClientById,
  listItems: listClients,
  notFoundMessage: 'Клиент не найден.',
  updateItem: updateClient,
});

export const contractsRouter = createCrudRouter({
  createItem: createContract,
  deleteItem: deleteContract,
  getItem: getContractById,
  listItems: listContracts,
  notFoundMessage: 'Договор не найден.',
  updateItem: updateContract,
});

export const employeesRouter = createCrudRouter({
  createItem: createEmployee,
  deleteItem: deleteEmployee,
  getItem: getEmployeeById,
  listItems: listEmployees,
  notFoundMessage: 'Сотрудник не найден.',
  updateItem: updateEmployee,
});
