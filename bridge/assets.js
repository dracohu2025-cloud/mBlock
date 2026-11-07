// Asset lifecycle operations. Use VM methods so references and UI stay in sync.
export function createAssetAdapter(vm) {
  const runtime = vm.runtime;
  const refresh = () => { runtime.emitProjectChanged(); vm.emitTargetsUpdate(); vm.emitWorkspaceUpdate(); };
  const name = value => {
    if (typeof value !== 'string' || !value.trim() || value.length > 100 || /[\x00-\x1f\x7f]/.test(value)) throw new Error('INVALID_ASSET_NAME');
    return value.trim();
  };
  const sprite = target => {
    if (target.isStage || target.deviceId || target.isOriginal === false) throw new Error('SPRITE_REQUIRED');
  };
  const unique = (value, except) => {
    if (['_mouse_', '_stage_', '_edge_', '_myself_', '_random_'].includes(value)) throw new Error('RESERVED_SPRITE_NAME');
    if (runtime.targets.some(t => t !== except && t.isOriginal !== false && t.getName() === value)) throw new Error('ASSET_NAME_EXISTS');
  };
  const checkedCostume = (target, p) => {
    if (target.deviceId) throw new Error('DEVICE_NOT_SUPPORTED');
    const c = target.getCostumes()[p.index];
    if (!Number.isInteger(p.index) || p.index < 0 || !c) throw new Error('COSTUME_NOT_FOUND');
    if (c.name !== p.expectedName) throw new Error('ASSET_CHANGED: 请重新查询素材');
    return c;
  };
  async function createSprite(p) {
    const requestedName = name(p.name); unique(requestedName);
    if (!vm.addSprite || !vm.deleteSprite) throw new Error('UNSUPPORTED_APP: 缺少角色管理接口');
    if (typeof p.base64 !== 'string' || p.base64.length > 30 * 1024 * 1024) throw new Error('INVALID_SPRITE_SIZE');
    const before = new Set(runtime.targets.map(t => t.id));
    const previous = vm.editingTarget;
    let created;
    try {
      await vm.addSprite(Uint8Array.from(atob(p.base64), c => c.charCodeAt(0)));
      const candidates = runtime.targets.filter(t => !before.has(t.id) && t.isOriginal !== false && t.getName() === requestedName);
      if (candidates.length !== 1) throw new Error('SPRITE_CREATE_NOT_CONFIRMED');
      created = candidates[0]; sprite(created);
      const costumes = created.getCostumes();
      if (costumes.length !== 1 || costumes[0].broken || costumes[0].skinId == null || !costumes[0].asset?.data?.length ||
          !costumes[0].size?.every(v => Number.isFinite(v) && v > 0)) throw new Error('IMAGE_IMPORT_NOT_CONFIRMED');
      refresh();
      return { target: created.id, name: created.getName(), x: created.x, y: created.y, size: created.size,
        costume: { name: costumes[0].name, assetId: costumes[0].assetId, dataFormat: costumes[0].dataFormat } };
    } catch (error) {
      // Only remove the uniquely identified sprite owned by this request.
      const candidates = runtime.targets.filter(t => !before.has(t.id) && t.getName() === requestedName && !t.isStage && !t.deviceId);
      if (candidates.length === 1) vm.deleteSprite(candidates[0].id);
      if (previous && runtime.targets.includes(previous)) vm.setEditingTarget(previous.id);
      throw error;
    }
  }
  function renameSprite(target, p) {
    sprite(target); const next = name(p.name); unique(next, target);
    const previous = target.getName();
    vm.renameSprite(target.id, next);
    if (target.getName() !== next) throw new Error('RENAME_NOT_CONFIRMED');
    refresh(); return { target: target.id, previous, name: target.getName() };
  }
  function deleteSprite(target, p) {
    sprite(target);
    if (target.getName() !== p.expectedName) throw new Error('ASSET_CHANGED: 请重新查询角色');
    const id = target.id, previous = target.getName();
    vm.deleteSprite(id);
    if (runtime.targets.some(t => t.id === id)) throw new Error('DELETE_NOT_CONFIRMED');
    refresh(); return { target: id, name: previous, deleted: true };
  }
  function renameCostume(target, p) {
    const c = checkedCostume(target, p), next = name(p.name), previous = c.name;
    if (target.getCostumes().some(other => other !== c && other.name === next)) throw new Error('ASSET_NAME_EXISTS');
    target.renameCostume(p.index, next);
    if (c.name !== next) throw new Error('RENAME_NOT_CONFIRMED');
    refresh(); return { target: target.id, index: p.index, previous, name: c.name };
  }
  function deleteCostume(target, p) {
    const c = checkedCostume(target, p);
    if (target.getCostumes().length <= 1) throw new Error('LAST_COSTUME: 必须保留至少一个造型或背景');
    target.deleteCostume(p.index);
    if (target.getCostumes().includes(c)) throw new Error('DELETE_NOT_CONFIRMED');
    refresh(); return { target: target.id, name: c.name, deleted: true, currentCostume: target.currentCostume,
      total: target.getCostumes().length };
  }
  return { createSprite, renameSprite, deleteSprite, renameCostume, deleteCostume };
}
