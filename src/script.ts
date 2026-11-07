export interface BlockSpec {
  opcode: string;
  fields?: Record<string, string>;
  inputs?: Record<string, string | number | BlockSpec>;
  substack?: BlockSpec[];
  substack2?: BlockSpec[];
}

const escape = (value: string | number) => String(value).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

export function scriptXml(blocks: BlockSpec[], x = 80, y = 80): string {
  let count = 0;
  function chain(nodes: BlockSpec[], depth: number): string {
    if (!nodes.length) return '';
    const [block, ...rest] = nodes;
    if (++count > 500 || depth > 30) throw new Error('SCRIPT_TOO_COMPLEX');
    let body = Object.entries(block.fields ?? {}).map(([key, value]) => `<field name="${escape(key)}">${escape(value)}</field>`).join('');
    for (const [name, input] of Object.entries(block.inputs ?? {})) {
      const child = typeof input === 'object' ? chain([input], depth + 1) :
        `<shadow type="${typeof input === 'number' ? 'math_number' : 'text'}"><field name="${typeof input === 'number' ? 'NUM' : 'TEXT'}">${escape(input)}</field></shadow>`;
      body += `<value name="${escape(name)}">${child}</value>`;
    }
    for (const [name, nested] of [['SUBSTACK', block.substack], ['SUBSTACK2', block.substack2]] as const) {
      if (nested?.length) body += `<statement name="${name}">${chain(nested, depth + 1)}</statement>`;
    }
    if (rest.length) body += `<next>${chain(rest, depth)}</next>`;
    return `<block type="${escape(block.opcode)}" x="${x}" y="${y}">${body}</block>`;
  }
  return `<xml xmlns="http://www.w3.org/1999/xhtml">${chain(blocks, 0)}</xml>`;
}
