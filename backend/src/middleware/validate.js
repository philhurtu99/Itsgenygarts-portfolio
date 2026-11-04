export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      return res.status(400).json({
        success: false,
        message: first?.message || 'Données invalides',
        errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}
