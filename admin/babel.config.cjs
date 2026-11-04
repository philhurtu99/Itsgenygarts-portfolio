function importMetaEnvPlugin({ types: t }) {
  return {
    name: 'vite-import-meta-env-to-process-env',
    visitor: {
      MemberExpression(path) {
        const node = path.node;
        if (
          t.isMemberExpression(node.object) &&
          t.isMetaProperty(node.object.object) &&
          node.object.object.meta.name === 'import' &&
          node.object.object.property.name === 'meta' &&
          t.isIdentifier(node.object.property, { name: 'env' })
        ) {
          const propName = node.computed
            ? node.property
            : t.stringLiteral(node.property.name);
          path.replaceWith(
            t.memberExpression(
              t.memberExpression(t.identifier('process'), t.identifier('env')),
              propName,
              true
            )
          );
        }
      },
      MetaProperty(path) {
        const node = path.node;
        if (node.meta.name === 'import' && node.property.name === 'meta') {
          path.replaceWith(
            t.objectExpression([
              t.objectProperty(
                t.identifier('env'),
                t.memberExpression(t.identifier('process'), t.identifier('env'))
              ),
            ])
          );
        }
      },
    },
  };
}

module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [importMetaEnvPlugin],
};
