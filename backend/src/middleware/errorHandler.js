export default function errorHandler(err, req, res, next) {
  console.error(err);

  const uploadTooLarge = err.code === 'LIMIT_FILE_SIZE';
  const status = uploadTooLarge ? 413 : err.status || err.statusCode || 500;
  const rawMessage = uploadTooLarge ? 'Photo trop volumineuse. Choisis une image plus légère.' : err.message || 'Internal server error';
  const exposeDetails = status < 500 || process.env.NODE_ENV !== 'production';
  const publicMessage = exposeDetails ? rawMessage : err.publicMessage || 'Internal server error';
  const message = req.t ? req.t(publicMessage) : publicMessage;
  const errors = exposeDetails ? err.errors || undefined : undefined;

  res.status(status).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
}
