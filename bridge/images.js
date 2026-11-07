// Image operations use VM asset loading so exported projects retain the actual pixels.
export function createImageAdapter(vm) {
  const runtime = vm.runtime;
  const describe = (costume, index) => ({ index, name: costume.name, assetId: costume.assetId,
    md5ext: costume.md5 ?? `${costume.assetId}.${costume.dataFormat}`, dataFormat: costume.dataFormat,
    bitmapResolution: costume.bitmapResolution, size: costume.size,
    rotationCenterX: costume.rotationCenterX, rotationCenterY: costume.rotationCenterY });
  const list = (target, p) => ({ target: target.id, isStage: target.isStage,
    currentCostume: target.currentCostume, total: target.getCostumes().length,
    costumes: target.getCostumes().map(describe).slice(p.offset ?? 0, (p.offset ?? 0) + (p.limit ?? 100)) });
  const select = (target, index) => {
    if (!Number.isInteger(index) || index < 0 || index >= target.getCostumes().length) throw new Error('COSTUME_NOT_FOUND');
    target.setCostume(index);
    runtime.emitProjectChanged(); vm.emitTargetsUpdate();
    return { target: target.id, currentCostume: target.currentCostume,
      costume: describe(target.getCostumes()[target.currentCostume], target.currentCostume) };
  };
  async function importImage(target, p) {
    if (!runtime.storage?.createAsset || !runtime.renderer || !vm.addCostume || !vm.addBackdrop) {
      throw new Error('UNSUPPORTED_APP: 缺少素材存储或渲染接口');
    }
    if (typeof p.base64 !== 'string' || p.base64.length > Math.ceil(20 * 1024 * 1024 / 3) * 4) {
      throw new Error('INVALID_IMAGE_SIZE');
    }
    if (![1, 2].includes(p.bitmapResolution) || typeof p.name !== 'string' || !p.name.trim()) {
      throw new Error('INVALID_IMAGE_PARAMETERS');
    }
    const bytes = Uint8Array.from(atob(p.base64), c => c.charCodeAt(0));
    if (![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) throw new Error('PNG_REQUIRED');
    const storage = runtime.storage;
    const asset = storage.createAsset(storage.AssetType.ImageBitmap, storage.DataFormat.PNG, bytes, null, true);
    const costume = { name: p.name, asset, assetId: asset.assetId, dataFormat: 'png',
      md5: `${asset.assetId}.png`, bitmapResolution: p.bitmapResolution };
    const previous = target.getCostumes()[target.currentCostume];
    try {
      if (target.isStage) await vm.addBackdrop(costume.md5, costume);
      else await vm.addCostume(costume.md5, costume, target.id);
      const index = target.getCostumes().indexOf(costume);
      if (!runtime.targets.includes(target)) throw new Error('TARGET_CHANGED_DURING_IMPORT');
      if (index < 0 || costume.broken || costume.skinId == null || !costume.asset?.data?.length ||
          !costume.size?.every(value => Number.isFinite(value) && value > 0)) {
        throw new Error('IMAGE_IMPORT_NOT_CONFIRMED: App 未正常加载图片');
      }
      if (!p.select && previous) target.setCostume(target.getCostumes().indexOf(previous));
      runtime.emitProjectChanged(); vm.emitTargetsUpdate();
      return { target: target.id, isStage: target.isStage, currentCostume: target.currentCostume,
        costume: describe(costume, index) };
    } catch (error) {
      // Remove only this request's costume; a fallback image must never count as success.
      const index = target.getCostumes().indexOf(costume);
      if (index >= 0) target.deleteCostume(index);
      const previousIndex = target.getCostumes().indexOf(previous);
      if (previousIndex >= 0) target.setCostume(previousIndex);
      vm.emitTargetsUpdate();
      throw error;
    }
  }
  return { list, select, importImage };
}
