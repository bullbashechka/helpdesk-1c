export function sendCreated(res, data) {
  res.status(201).json(data);
}

export function sendSuccess(res) {
  res.json({ success: true });
}
