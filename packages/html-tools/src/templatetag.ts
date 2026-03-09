/**
 * Represents a template tag placeholder in the HTML AST.
 *
 * This is an opaque container used by the tokenizer and parser to
 * hold template-specific data (e.g., Spacebars tags). The exact
 * properties are defined by the template system.
 */
export class TemplateTag {
  /** Identifier used by toJS visitors. */
  constructorName = 'TemplateTag';

  /** Allow arbitrary template-specific properties. */
  [key: string]: unknown;

  constructor(props?: Record<string, unknown>) {
    if (props) Object.assign(this, props);
  }

  /**
   * Serialize this tag to JS code via a visitor.
   * @param visitor - A toJS visitor with a `generateCall` method.
   * @returns JS code string.
   */
  toJS(visitor: {
    generateCall: (name: string, props: Record<string, unknown>) => string;
  }): string {
    return visitor.generateCall(this.constructorName, { ...this });
  }
}
