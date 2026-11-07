// Explicit targets avoid editingTarget races during asynchronous asset loading.
export function createMediaAdapter(vm) {
  const runtime = vm.runtime;
  const refresh = () => { runtime.emitProjectChanged(); vm.emitTargetsUpdate(); vm.emitWorkspaceUpdate(); };
  const validTarget = t => {
    if (t.deviceId || t.isOriginal === false) throw new Error('DEVICE_NOT_SUPPORTED');
    if (!runtime.targets.includes(t)) throw new Error('TARGET_CHANGED');
  };
  const validName = n => {
    if (typeof n !== 'string' || !n.trim() || n.length > 100 || /[\x00-\x1f\x7f]/.test(n)) throw new Error('INVALID_ASSET_NAME');
    return n.trim();
  };
  const check = (t, kind, p) => {
    validTarget(t);
    const items = kind === 'sound' ? t.getSounds() : t.getCostumes();
    const item = items[p.index];
    if (!Number.isInteger(p.index) || p.index < 0 || !item) throw new Error('ASSET_NOT_FOUND');
    if (item.name !== p.expectedName) throw new Error('ASSET_CHANGED: 请重新查询素材');
    return item;
  };
  const unused = (items, n, except) => {
    const value = validName(n);
    if (items.some(item => item !== except && item.name === value)) throw new Error('ASSET_NAME_EXISTS');
    return value;
  };
  const player = (t, s) => t.sprite.soundBank?.getSoundPlayer(s.soundId);
  const describe = (t, s, index) => {
    const p = s.soundId ? player(t, s) : null;
    return { index, name: s.name, assetId: s.assetId, dataFormat: s.dataFormat,
      sampleRate: s.rate, sampleCount: s.sampleCount, duration: p?.buffer?.duration ?? (s.rate ? s.sampleCount / s.rate : null),
      playing: Boolean(p?.isPlaying) };
  };
  function sounds(t, p) {
    validTarget(t);
    return { target: t.id, total: t.getSounds().length,
      sounds: t.getSounds().map((s, i) => describe(t, s, i)).slice(p.offset ?? 0, (p.offset ?? 0) + (p.limit ?? 100)) };
  }
  async function loadSound(t, sound) {
    validTarget(t);
    if (!vm.addSound || !runtime.audioEngine || !t.sprite.soundBank) throw new Error('UNSUPPORTED_APP: 缺少声音接口');
    try {
      await vm.addSound(sound, t.id);
      validTarget(t);
      const buffer = sound.soundId && player(t, sound)?.buffer;
      if (!t.getSounds().includes(sound) || sound.broken || !sound.asset?.data?.length || !buffer?.length) {
        throw new Error('SOUND_IMPORT_NOT_CONFIRMED');
      }
      refresh();
      return { target: t.id, sound: describe(t, sound, t.getSounds().indexOf(sound)) };
    } catch (error) {
      const i = t.getSounds().indexOf(sound);
      if (i >= 0) t.deleteSound(i);
      refresh(); throw error;
    }
  }
  async function importSound(t, p) {
    const name = unused(t.getSounds(), p.name);
    if (typeof p.base64 !== 'string' || p.base64.length > 29 * 1024 * 1024) throw new Error('INVALID_SOUND_SIZE');
    const bytes = Uint8Array.from(atob(p.base64), c => c.charCodeAt(0));
    if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.subarray(8, 12)) !== 'WAVE') throw new Error('WAV_REQUIRED');
    const storage = runtime.storage;
    if (!storage?.createAsset) throw new Error('UNSUPPORTED_APP');
    const asset = storage.createAsset(storage.AssetType.Sound, storage.DataFormat.WAV, bytes, null, true);
    return loadSound(t, { name, asset, assetId: asset.assetId, dataFormat: 'wav', md5: `${asset.assetId}.wav`, format: '' });
  }
  function renameSound(t, p) {
    const s = check(t, 'sound', p), name = unused(t.getSounds(), p.name, s), previous = s.name;
    t.renameSound(p.index, name);
    if (s.name !== name) throw new Error('RENAME_NOT_CONFIRMED');
    refresh(); return { target: t.id, previous, sound: describe(t, s, p.index) };
  }
  function deleteSound(t, p) {
    const s = check(t, 'sound', p);
    t.sprite.soundBank?.stop(t, s.soundId);
    t.deleteSound(p.index);
    if (t.getSounds().includes(s)) throw new Error('DELETE_NOT_CONFIRMED');
    refresh(); return { target: t.id, name: s.name, deleted: true, total: t.getSounds().length };
  }
  async function playSound(t, p) {
    const s = check(t, 'sound', p), bank = t.sprite.soundBank;
    const context = runtime.audioEngine?.audioContext;
    if (!bank || !context || !player(t, s)?.buffer) throw new Error('SOUND_NOT_LOADED');
    if (context.state === 'suspended') {
      let timer;
      try {
        await Promise.race([context.resume(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('AUDIO_RESUME_TIMEOUT')), 2000); })]);
      } finally { clearTimeout(timer); }
    }
    if (context.state !== 'running') throw new Error('AUDIO_NOT_RUNNING');
    const finished = bank.playSound(t, s.soundId);
    // Playback must not hold the bridge queue: stop_sounds must remain callable.
    Promise.resolve(finished).catch(() => {});
    if (!player(t, s).isPlaying) throw new Error('PLAYBACK_NOT_CONFIRMED');
    return { target: t.id, started: true, sound: describe(t, s, p.index), audioContextState: context.state };
  }
  function stopSounds(t) {
    validTarget(t);
    const bank = t.sprite.soundBank;
    if (!bank) throw new Error('UNSUPPORTED_APP');
    bank.stopAllSounds(t);
    return { target: t.id, stopRequested: true }; // The engine may fade out briefly.
  }
  function reorder(t, p, kind) {
    const item = check(t, kind, p), items = kind === 'sound' ? t.getSounds() : t.getCostumes();
    if (!Number.isInteger(p.toIndex) || p.toIndex < 0 || p.toIndex >= items.length) throw new Error('INVALID_DESTINATION_INDEX');
    const current = kind === 'costume' ? items[t.currentCostume] : null;
    if (kind === 'sound') t.reorderSound(p.index, p.toIndex); else t.reorderCostume(p.index, p.toIndex);
    if (items[p.toIndex] !== item || (current && items[t.currentCostume] !== current)) throw new Error('REORDER_NOT_CONFIRMED');
    refresh(); return { target: t.id, order: items.map((v, index) => ({ index, name: v.name })),
      ...(kind === 'costume' ? { currentCostume: t.currentCostume } : {}) };
  }
  async function duplicateSound(t, p) {
    const s = check(t, 'sound', p), name = unused(t.getSounds(), p.name);
    if (s.broken || !s.asset?.data?.length) throw new Error('SOURCE_ASSET_BROKEN');
    return loadSound(t, { ...s, name, soundId: undefined });
  }
  async function duplicateCostume(t, p) {
    const c = check(t, 'costume', p), name = unused(t.getCostumes(), p.name);
    if (c.broken || !c.asset?.data?.length) throw new Error('SOURCE_ASSET_BROKEN');
    const previous = t.getCostumes()[t.currentCostume], copy = { ...c, name, skinId: undefined };
    try {
      if (t.isStage) await vm.addBackdrop(copy.md5 ?? `${copy.assetId}.${copy.dataFormat}`, copy);
      else await vm.addCostume(copy.md5 ?? `${copy.assetId}.${copy.dataFormat}`, copy, t.id);
      validTarget(t);
      if (!t.getCostumes().includes(copy) || copy.broken || copy.skinId == null) throw new Error('COPY_NOT_CONFIRMED');
      if (!p.select) t.setCostume(t.getCostumes().indexOf(previous));
      refresh(); return { target: t.id, index: t.getCostumes().indexOf(copy), name: copy.name, currentCostume: t.currentCostume };
    } catch (error) {
      const i = t.getCostumes().indexOf(copy); if (i >= 0) t.deleteCostume(i);
      const old = t.getCostumes().indexOf(previous); if (old >= 0) t.setCostume(old);
      refresh(); throw error;
    }
  }
  async function duplicateSprite(t, p) {
    validTarget(t);
    if (t.isStage) throw new Error('SPRITE_REQUIRED');
    const name = unused(runtime.targets.filter(t => t.isOriginal !== false).map(t => ({ name: t.getName() })), p.name);
    if (['_mouse_', '_stage_', '_edge_', '_myself_', '_random_'].includes(name)) throw new Error('RESERVED_SPRITE_NAME');
    if (!t.duplicate || !runtime.addTarget) throw new Error('UNSUPPORTED_APP');
    // The original VM implementation returns no target; use its underlying duplicate method
    // to retain the exact new target identity even if the user edits another sprite concurrently.
    const created = await t.duplicate();
    try {
      validTarget(t);
      unused(runtime.targets.filter(t => t.isOriginal !== false).map(t => ({ name: t.getName() })), name);
      created.sprite.name = name;
      runtime.addTarget(created); created.goBehindOther(t);
      created.setXY(p.x ?? t.x, p.y ?? t.y);
      if (created.getCostumes().some(c => c.broken || c.skinId == null) || created.getSounds().some(s => s.broken || !s.soundId)) throw new Error('COPY_NOT_CONFIRMED');
      vm.setEditingTarget(created.id); refresh();
      return { target: created.id, name: created.getName(), source: t.id, x: created.x, y: created.y,
        costumes: created.getCostumes().length, sounds: created.getSounds().length, blocks: Object.keys(created.blocks._blocks).length };
    } catch (error) {
      if (runtime.targets.includes(created)) vm.deleteSprite(created.id);
      else { created.dispose(); created.sprite.dispose(); }
      throw error;
    }
  }
  function layers() {
    const entries = runtime.targets.filter(t => t.isOriginal !== false && !t.isStage && !t.deviceId)
      .map(t => ({ target: t.id, name: t.getName(), layerOrder: t.getLayerOrder() }));
    if (entries.some(t => !Number.isFinite(t.layerOrder))) throw new Error('RENDERER_NOT_READY');
    return { order: entries.sort((a, b) => a.layerOrder - b.layerOrder), direction: 'back-to-front' };
  }
  function setLayer(t, p) {
    validTarget(t); if (t.isStage) throw new Error('SPRITE_REQUIRED');
    layers();
    if (p.direction === 'front') t.goToFront();
    else if (p.direction === 'back') t.goToBack();
    else if (p.direction === 'forward') t.goForwardLayers(p.steps);
    else if (p.direction === 'backward') t.goBackwardLayers(p.steps);
    else throw new Error('INVALID_LAYER_DIRECTION');
    runtime.requestRedraw(); refresh();
    return { target: t.id, ...layers() };
  }
  return { sounds, importSound, renameSound, deleteSound, playSound, stopSounds, duplicateSound, duplicateCostume,
    duplicateSprite, layers, setLayer, reorderCostume: (t, p) => reorder(t, p, 'costume'), reorderSound: (t, p) => reorder(t, p, 'sound') };
}
