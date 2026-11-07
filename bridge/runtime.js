// Adapter for the native mBlock 5.6.0 extension context. No arbitrary eval/IPC.
export function createAdapter(app) {
  const context = app._mCtx;
  const vm = context?.vmCtx?.vm;
  const blockly = context?.blocklyCtx?.blockly;
  if (!vm?.runtime || !blockly?.Xml) throw new Error('UNSUPPORTED_APP: 缺少 mBlock VM/Blockly 接口');
  const runtime = vm.runtime;
  const copy = value => JSON.parse(JSON.stringify(value));
  const target = id => {
    const found = runtime.targets.filter(t => t.isOriginal !== false && (t.id === id || t.getName() === id));
    if (found.length !== 1) throw new Error(`TARGET_NOT_UNIQUE: ${id}`);
    return found[0];
  };
  const summary = t => ({ id: t.id, name: t.getName(), isStage: t.isStage,
    deviceId: t.deviceId ?? null, x: t.x, y: t.y, direction: t.direction,
    blocks: Object.keys(t.blocks._blocks).length });
  const ensureSprite = t => {
    if (t.deviceId) throw new Error('DEVICE_NOT_SUPPORTED: 此版本只修改和运行舞台/角色，不执行硬件命令');
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const refresh = () => { vm.emitWorkspaceUpdate(); vm.emitTargetsUpdate(); };
  const lookupVariable = (t, name) => {
    const vars = Object.values(t.variables).filter(v => v.name === name && v.type === '');
    if (vars.length !== 1) throw new Error(`VARIABLE_NOT_FOUND: ${name}`);
    return vars[0];
  };

  async function addXml(params) {
    const t = target(params.target); ensureSprite(t);
    if (typeof params.xml !== 'string' || params.xml.length > 200000) throw new Error('INVALID_XML_SIZE');
    if (/<!DOCTYPE|<!ENTITY/i.test(params.xml)) throw new Error('XML_ENTITIES_NOT_ALLOWED');
    const dom = blockly.Xml.textToDom(params.xml);
    const allowed = new Set(['xml', 'block', 'shadow', 'value', 'statement', 'next', 'field', 'mutation', 'arg']);
    const nodes = [dom, ...dom.querySelectorAll('*')];
    if (dom.tagName.toLowerCase() !== 'xml' || nodes.length > 5000) throw new Error('INVALID_XML_ROOT_OR_SIZE');
    for (const node of nodes) {
      if (!allowed.has(node.tagName.toLowerCase())) throw new Error(`XML_ELEMENT_NOT_ALLOWED: ${node.tagName}`);
      if (node.tagName === 'block' || node.tagName === 'shadow') {
        const type = node.getAttribute('type');
        if (!type || !blockly.Blocks[type]) throw new Error(`UNKNOWN_OPCODE: ${type}`);
        node.removeAttribute('id');
      }
    }
    vm.setEditingTarget(t.id);
    await pause();
    const workspace = context.blocklyCtx.workspace;
    if (!workspace || vm.editingTarget?.id !== t.id) throw new Error('WORKSPACE_NOT_READY');
    const before = new Set(Object.keys(t.blocks._blocks));
    const beforeWorkspace = new Set(workspace.getAllBlocks(false).map(b => b.id));
    const group = `mcp-${Date.now()}`;
    blockly.Events.setGroup(group);
    try {
      blockly.Xml.domToWorkspace(dom, workspace);
      await pause(); await pause();
      const added = workspace.getAllBlocks(false).filter(b => !beforeWorkspace.has(b.id));
      if (!added.length || added.some(b => !t.blocks.getBlock(b.id))) throw new Error('VM_WRITE_NOT_CONFIRMED');
      const ids = added.map(b => b.id);
      runtime.emitProjectChanged();
      return { target: t.id, addedIds: ids, topLevelIds: ids.filter(id => t.blocks.getBlock(id).topLevel),
        blocks: ids.map(id => copy(t.blocks.getBlock(id))) };
    } catch (error) {
      // Roll back only blocks created by this request, preserving existing work.
      workspace.getTopBlocks(false).filter(b => !beforeWorkspace.has(b.id)).forEach(b => b.dispose(false));
      await pause();
      for (const id of Object.keys(t.blocks._blocks)) if (!before.has(id)) t.blocks.deleteBlock(id);
      refresh();
      throw error;
    } finally { blockly.Events.setGroup(false); }
  }

  return async function dispatch(method, p = {}) {
    if (method === 'status') return { adapter: 'mblock-5.6', editingTarget: vm.editingTarget?.id,
      targets: runtime.targets.filter(t => t.isOriginal !== false).map(summary), threads: runtime.threads.length };
    if (method === 'targets') return { targets: runtime.targets.filter(t => t.isOriginal !== false).map(summary) };
    if (method === 'blocks') {
      const t = target(p.target);
      const all = Object.values(t.blocks._blocks);
      return { target: summary(t), total: all.length, blocks: copy(all.slice(p.offset ?? 0, (p.offset ?? 0) + (p.limit ?? 100))) };
    }
    if (method === 'catalog') {
      const types = Object.keys(blockly.Blocks).filter(type => type.includes(p.query ?? '')).sort();
      return { total: types.length, opcodes: types.slice(p.offset ?? 0, (p.offset ?? 0) + (p.limit ?? 100)) };
    }
    if (method === 'addXml') return addXml(p);
    if (method === 'setBlockField') {
      const t = target(p.target); ensureSprite(t);
      if (!t.blocks.getBlock(p.blockId)) throw new Error('BLOCK_NOT_FOUND');
      vm.setEditingTarget(t.id); await pause();
      const block = context.blocklyCtx.workspace?.getBlockById(p.blockId);
      const field = block?.getField(p.field);
      if (!field) throw new Error(`FIELD_NOT_FOUND: ${p.field}`);
      const previous = field.getValue();
      field.setValue(p.value);
      await pause(); await pause();
      const actual = t.blocks.getBlock(p.blockId)?.fields[p.field];
      if (!actual) { field.setValue(previous); throw new Error('VM_FIELD_WRITE_NOT_CONFIRMED'); }
      runtime.emitProjectChanged();
      return { target: t.id, blockId: p.blockId, field: p.field, actual: copy(actual), previous };
    }
    if (method === 'variables') {
      const t = target(p.target);
      return { target: t.id, variables: Object.values(t.variables).map(v => ({ id: v.id, name: v.name, type: v.type, value: copy(v.value) })) };
    }
    if (method === 'setVariable') {
      const t = target(p.target); ensureSprite(t);
      if (typeof p.value !== 'string' && typeof p.value !== 'number') throw new Error('INVALID_VARIABLE_VALUE');
      const v = lookupVariable(t, p.name); v.value = p.value;
      runtime.emitProjectChanged();
      return { id: v.id, name: v.name, value: v.value };
    }
    if (method === 'createVariable') {
      const t = target(p.target); ensureSprite(t);
      if (Object.values(t.variables).some(v => v.name === p.name && v.type === '')) throw new Error('VARIABLE_ALREADY_EXISTS');
      const id = blockly.utils.genUid();
      t.createVariable(id, p.name, '', false);
      const v = lookupVariable(t, p.name); v.value = p.value ?? 0;
      refresh(); return { id: v.id, name: v.name, value: v.value };
    }
    if (method === 'runScript') {
      const t = target(p.target); ensureSprite(t);
      const block = t.blocks.getBlock(p.blockId);
      if (!block?.topLevel || block.shadow) throw new Error('TOP_LEVEL_BLOCK_REQUIRED');
      if (runtime.threads.some(thread => thread.target === t && thread.topBlock === p.blockId)) throw new Error('SCRIPT_ALREADY_RUNNING');
      runtime.toggleScript(p.blockId, { target: t, stackClick: true });
      return { target: t.id, blockId: p.blockId, started: true };
    }
    if (method === 'stopTarget') {
      const t = target(p.target); ensureSprite(t);
      const threads = runtime.threads.filter(thread => thread.target === t);
      threads.forEach(thread => runtime._stopThread(thread));
      return { target: t.id, stopped: threads.length };
    }
    if (method === 'exportProject') {
      const blob = await vm.saveProjectSb3(async zip => {
        const spritesState = {};
        for (const t of runtime.targets.filter(t => t.isOriginal !== false)) {
          const info = context.extCtx.getDeviceInfo(t.deviceId);
          spritesState[t.id] = { id: t.id, name: t.getName(), deviceId: t.deviceId,
            codeTypes: info?.codeTypes ?? ['python'], editorMode: t.editorMode,
            codes: context.vmCtx.targetsCode[t.id], online: t.online, isEditing: t.id === vm.editingTarget?.id };
        }
        zip.file('mscratch.json', JSON.stringify({ spritesState, extensions: context.extCtx.getDataFromExtensions() }));
        zip.file('mblock5', JSON.stringify({ version: '5.6.0', createdAt: Date.now() }));
        app.setMblockZipHandler(zip);
        await context.extCtx.emitExtHandler('beforePackProject');
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.length > 40 * 1024 * 1024) throw new Error('PROJECT_TOO_LARGE: 当前导出上限为 40 MiB');
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { base64: btoa(binary), bytes: bytes.length };
    }
    throw new Error(`UNKNOWN_METHOD: ${method}`);
  };
}
