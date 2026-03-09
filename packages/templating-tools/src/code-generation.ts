/**
 * Generate JavaScript code that registers a named template.
 *
 * @param name - The template name.
 * @param renderFuncCode - The compiled render function source code.
 * @param useHMR - Whether to emit HMR (hot module replacement) support code.
 * @returns JavaScript source string.
 */
export function generateTemplateJS(name: string, renderFuncCode: string, useHMR?: boolean): string {
  const nameLiteral = JSON.stringify(name);
  const templateDotNameLiteral = JSON.stringify(`Template.${name}`);

  if (useHMR) {
    return `
Template._migrateTemplate(
  ${nameLiteral},
  new Template(${templateDotNameLiteral}, ${renderFuncCode})
);
if (typeof module === "object" && module.hot) {
  module.hot.accept();
  module.hot.dispose(function () {
    Template.__pendingReplacement.push(${nameLiteral});
    Template._applyHmrChanges(${nameLiteral});
  });
}
`;
  }

  return `
Template.__checkName(${nameLiteral});
Template[${nameLiteral}] = new Template(${templateDotNameLiteral}, ${renderFuncCode});
`;
}

/**
 * Generate JavaScript code that adds body content.
 *
 * @param renderFuncCode - The compiled render function source code.
 * @param useHMR - Whether to emit HMR support code.
 * @returns JavaScript source string.
 */
export function generateBodyJS(renderFuncCode: string, useHMR?: boolean): string {
  if (useHMR) {
    return `
(function () {
  var renderFunc = ${renderFuncCode};
  Template.body.addContent(renderFunc);
  Meteor.startup(Template.body.renderToDocument);
  if (typeof module === "object" && module.hot) {
    module.hot.accept();
    module.hot.dispose(function () {
      var index = Template.body.contentRenderFuncs.indexOf(renderFunc)
      Template.body.contentRenderFuncs.splice(index, 1);
      Template._applyHmrChanges();
    });
  }
})();
`;
  }

  return `
Template.body.addContent(${renderFuncCode});
Meteor.startup(Template.body.renderToDocument);
`;
}
