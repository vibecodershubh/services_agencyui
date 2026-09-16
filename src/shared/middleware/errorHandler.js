export function errorHandler(err, req, res, next) {
  console.error("[error]", err.message);
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? "internal error" : err.message });
}
