import * as THREE from 'three';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function normalizeWeights(w) {
  const sum = w[0] + w[1] + w[2] + w[3];
  if (sum > 1e-6) {
    w[0] /= sum;
    w[1] /= sum;
    w[2] /= sum;
    w[3] /= sum;
  } else {
    w[0] = 1;
    w[1] = 0;
    w[2] = 0;
    w[3] = 0;
  }
}

/**
 * Finds connected polygon islands in a BufferGeometry (merging vertices at identical positions)
 * so rigid armor plates (kneecaps, shins, boots, chest plates) receive uniform rigid bone weights
 * and never stretch like rubber.
 */
function analyzeComponents(geom) {
  const pos = geom.attributes.position;
  const count = pos.count;
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;

  const posMap = new Map();
  for (let i = 0; i < count; i++) {
    const key =
      Math.round(pos.getX(i) * 1000) + ',' +
      Math.round(pos.getY(i) * 1000) + ',' +
      Math.round(pos.getZ(i) * 1000);
    const existing = posMap.get(key);
    if (existing !== undefined) {
      parent[i] = existing;
    } else {
      posMap.set(key, i);
    }
  }

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function unite(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  const index = geom.index;
  if (index) {
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) {
      unite(arr[i], arr[i + 1]);
      unite(arr[i + 1], arr[i + 2]);
    }
  } else {
    for (let i = 0; i < count; i += 3) {
      unite(i, i + 1);
      unite(i + 1, i + 2);
    }
  }

  const stats = new Map();
  const rootOfVertex = new Int32Array(count);

  for (let i = 0; i < count; i++) {
    const r = find(i);
    rootOfVertex[i] = r;
    let st = stats.get(r);
    if (!st) {
      st = {
        count: 0,
        minX: Infinity, maxX: -Infinity,
        minY: Infinity, maxY: -Infinity,
        minZ: Infinity, maxZ: -Infinity,
        sumX: 0, sumY: 0, sumZ: 0
      };
      stats.set(r, st);
    }
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    st.count++;
    st.minX = Math.min(st.minX, x);
    st.maxX = Math.max(st.maxX, x);
    st.minY = Math.min(st.minY, y);
    st.maxY = Math.max(st.maxY, y);
    st.minZ = Math.min(st.minZ, z);
    st.maxZ = Math.max(st.maxZ, z);
    st.sumX += x;
    st.sumY += y;
    st.sumZ += z;
  }

  for (const st of stats.values()) {
    st.avgX = st.sumX / st.count;
    st.avgY = st.sumY / st.count;
    st.avgZ = st.sumZ / st.count;
  }

  return { rootOfVertex, stats };
}

function computeRifleMuzzle(rifleGeometries) {
  // Forward barrel projection (+Z forward, slight +X left-diagonal) works cleanly for both HD and FNV stances
  const dx = 0.42;
  const dz = 0.90;
  let maxProj = -Infinity;

  for (const geom of rifleGeometries) {
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = pos.getX(i) * dx + pos.getZ(i) * dz;
      if (s > maxProj) maxProj = s;
    }
  }

  let tipX = 0, tipY = 0, tipZ = 0, tipC = 0;
  let midX = 0, midY = 0, midZ = 0, midC = 0;
  for (const geom of rifleGeometries) {
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const s = x * dx + z * dz;
      if (s >= maxProj - 0.025) {
        tipX += x; tipY += y; tipZ += z; tipC++;
      } else if (s >= maxProj - 0.36 && s <= maxProj - 0.05) {
        midX += x; midY += y; midZ += z; midC++;
      }
    }
  }

  const muzzlePoint = tipC > 0
    ? new THREE.Vector3(tipX / tipC, tipY / tipC, tipZ / tipC)
    : new THREE.Vector3(0.71, 1.50, 0.84);
  const barrelDir = (tipC > 0 && midC > 0)
    ? new THREE.Vector3(tipX / tipC - midX / midC, tipY / tipC - midY / midC, tipZ / tipC - midZ / midC).normalize()
    : new THREE.Vector3(0.76, 0.0, 0.65).normalize();

  return { muzzlePoint, barrelDir };
}

function attachFnvRiggedModel(gltfScene, animations = []) {
  gltfScene.updateMatrixWorld(true);

  const bip01 = gltfScene.getObjectByName('Bip01');
  const weaponBone = gltfScene.getObjectByName('Weapon');
  const headBone = gltfScene.getObjectByName('Bip01 Head');
  const spine2Bone = gltfScene.getObjectByName('Bip01 Spine2');
  const nonAccumBone = gltfScene.getObjectByName('Bip01 NonAccum');
  if (!bip01 || !weaponBone) return null;

  let skeleton = null;
  let eyeMaterial = null;
  let glowMaterial = null;
  const rifleFrontGeoms = [];
  const rifleAllGeoms = [];

  gltfScene.traverse((obj) => {
    if (obj.isSkinnedMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      if (!skeleton && obj.skeleton) skeleton = obj.skeleton;

      const lower = obj.name.toLowerCase();
      if (lower.includes('gaussrifle') && obj.geometry) {
        rifleAllGeoms.push(obj.geometry);
        if (lower.includes('front')) rifleFrontGeoms.push(obj.geometry);
      }

      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (mat) {
        mat.envMapIntensity = 1.25;
        if (mat.emissiveTexture || (mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.1))) {
          if (lower.includes('helmet')) {
            eyeMaterial = mat;
            mat.emissiveIntensity = 2.6;
          } else {
            glowMaterial = mat;
            mat.emissiveIntensity = 2.6;
          }
        }
      }
    }
  });

  const { muzzlePoint, barrelDir } = computeRifleMuzzle(rifleFrontGeoms.length ? rifleFrontGeoms : rifleAllGeoms);
  const muzzleTargetWorld = muzzlePoint.clone().add(barrelDir);

  weaponBone.updateMatrixWorld(true);
  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.name = 'muzzleAnchor';
  muzzleAnchor.position.copy(weaponBone.worldToLocal(muzzlePoint.clone()));
  weaponBone.add(muzzleAnchor);

  const muzzleTarget = new THREE.Object3D();
  muzzleTarget.name = 'muzzleTarget';
  muzzleTarget.position.copy(weaponBone.worldToLocal(muzzleTargetWorld));
  weaponBone.add(muzzleTarget);

  const clips = new Map();
  for (const clip of animations) {
    clips.set(clip.name, clip);
  }

  return {
    isFnvClipRig: true,
    group: gltfScene,
    skeleton,
    clips,
    weaponGroup: null,
    bipBones: {
      bip01,
      nonAccum: nonAccumBone,
      pelvis: gltfScene.getObjectByName('Bip01 Pelvis'),
      spine2: spine2Bone,
      head: headBone,
      leftThigh: gltfScene.getObjectByName('Bip01 L Thigh'),
      leftCalf: gltfScene.getObjectByName('Bip01 L Calf'),
      rightThigh: gltfScene.getObjectByName('Bip01 R Thigh'),
      rightCalf: gltfScene.getObjectByName('Bip01 R Calf'),
      weapon: weaponBone
    },
    bones: {},
    muzzleAnchor,
    muzzleTarget,
    materials: {
      eye: eyeMaterial,
      glow: glowMaterial,
      glass: null
    },
    restPose: {
      nonAccumPos: nonAccumBone ? nonAccumBone.position.clone() : new THREE.Vector3(),
      pelvisPos: new THREE.Vector3()
    }
  };
}

export function attachWeaponToRig(rig, weaponScene) {
  if (!rig || !rig.bipBones?.weapon || !weaponScene) return;
  const weaponBone = rig.bipBones.weapon;

  if (rig.weaponGroup) {
    weaponBone.remove(rig.weaponGroup);
    rig.weaponGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
            if (m[key] && m[key].dispose) m[key].dispose();
          }
          m.dispose();
        }
      }
    });
    rig.weaponGroup = null;
  }

  // Compute exact barrel tip along -X in Weapon-bone local space
  let minX = Infinity;
  const geoms = [];
  weaponScene.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (mat) mat.envMapIntensity = 1.25;
      geoms.push(obj.geometry);
      const pos = obj.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        minX = Math.min(minX, pos.getX(i));
      }
    }
  });

  let sx = 0, sy = 0, sz = 0, sc = 0;
  for (const geom of geoms) {
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x <= minX + 0.025) {
        sx += x; sy += pos.getY(i); sz += pos.getZ(i); sc++;
      }
    }
  }

  const tipLocal = sc > 0
    ? new THREE.Vector3(sx / sc, sy / sc, sz / sc)
    : new THREE.Vector3(-0.75, 0.0, 0.05);

  rig.muzzleAnchor.position.copy(tipLocal);
  rig.muzzleTarget.position.copy(tipLocal).add(new THREE.Vector3(-1, 0, 0));

  weaponBone.add(weaponScene);
  rig.weaponGroup = weaponScene;
}

function attachPreRiggedEnclaveModel(gltfScene) {
  gltfScene.updateMatrixWorld(true);

  const boneNames = [
    'root', 'pelvis', 'spine', 'head', 'arms',
    'leftThigh', 'leftKnee', 'leftShin', 'leftFoot',
    'rightThigh', 'rightKnee', 'rightShin', 'rightFoot'
  ];
  const bones = {};
  for (const bName of boneNames) {
    const b = gltfScene.getObjectByName(bName);
    if (!b) return null;
    bones[bName] = b;
  }

  let skeleton = null;
  let eyeMaterial = null;
  let glowMaterial = null;
  const rifleGeoms = [];

  gltfScene.traverse((obj) => {
    if (obj.isSkinnedMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      if (!skeleton && obj.skeleton) skeleton = obj.skeleton;
      if (obj.name.toLowerCase().includes('gaussrifle') && obj.geometry) {
        rifleGeoms.push(obj.geometry);
      }

      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (mat) {
        mat.envMapIntensity = 1.25;
        if (mat.emissiveTexture || (mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.1))) {
          if (obj.name.toLowerCase().includes('helmet')) {
            eyeMaterial = mat;
            mat.emissiveIntensity = 2.6;
          } else {
            glowMaterial = mat;
            mat.emissiveIntensity = 2.6;
          }
        }
      }
    }
  });

  const { muzzlePoint, barrelDir } = computeRifleMuzzle(rifleGeoms);
  const muzzleTargetWorld = muzzlePoint.clone().add(barrelDir);

  bones.arms.updateMatrixWorld(true);
  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.name = 'muzzleAnchor';
  muzzleAnchor.position.copy(bones.arms.worldToLocal(muzzlePoint.clone()));
  bones.arms.add(muzzleAnchor);

  const muzzleTarget = new THREE.Object3D();
  muzzleTarget.name = 'muzzleTarget';
  muzzleTarget.position.copy(bones.arms.worldToLocal(muzzleTargetWorld));
  bones.arms.add(muzzleTarget);

  return {
    group: gltfScene,
    skeleton,
    bones,
    muzzleAnchor,
    muzzleTarget,
    materials: {
      eye: eyeMaterial,
      glow: glowMaterial,
      glass: null
    },
    restPose: {
      pelvisPos: bones.pelvis.position.clone()
    }
  };
}

/**
 * Normalizes the Enclave Advanced Power Armor GLTF scene (height 2.0, feet at y=0, facing +Z),
 * builds an articulated 13-bone Skeleton (including rigid kneecap & ankle bones),
 * and converts every mesh into a THREE.SkinnedMesh.
 */
export function buildEnclaveRig(gltfScene, animations = []) {
  gltfScene.updateMatrixWorld(true);

  if (gltfScene.getObjectByName('Bip01') && gltfScene.getObjectByName('Weapon')) {
    const fnvRig = attachFnvRiggedModel(gltfScene, animations);
    if (fnvRig) return fnvRig;
  }

  if (gltfScene.getObjectByName('pelvis') && gltfScene.getObjectByName('leftFoot')) {
    const preRigged = attachPreRiggedEnclaveModel(gltfScene);
    if (preRigged) return preRigged;
  }

  const rawMeshes = [];
  gltfScene.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      rawMeshes.push(obj);
    }
  });

  const bakedParts = [];
  const globalBox = new THREE.Box3();

  for (const mesh of rawMeshes) {
    const geom = mesh.geometry.clone();
    geom.applyMatrix4(mesh.matrixWorld);
    geom.computeBoundingBox();
    globalBox.union(geom.boundingBox);

    bakedParts.push({
      name: mesh.name,
      geometry: geom,
      material: mesh.material
    });
  }

  const totalHeight = Math.max(0.001, globalBox.max.y - globalBox.min.y);
  const scale = 2.0 / totalHeight;

  const footThresholdY = globalBox.min.y + totalHeight * 0.05;
  let footSumX = 0, footSumZ = 0, footCount = 0;
  for (const part of bakedParts) {
    if (!part.name.includes('Legs')) continue;
    const pos = part.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) <= footThresholdY) {
        footSumX += pos.getX(i);
        footSumZ += pos.getZ(i);
        footCount++;
      }
    }
  }

  const centerX = footCount > 0 ? footSumX / footCount : (globalBox.min.x + globalBox.max.x) * 0.5;
  const centerZ = footCount > 0 ? footSumZ / footCount : (globalBox.min.z + globalBox.max.z) * 0.5;
  const baseY = globalBox.min.y;

  const normMatrix = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-centerX, -baseY, -centerZ));

  const boxesByPart = {};
  let leftFootSumX = 0, leftFootCount = 0;
  let rightFootSumX = 0, rightFootCount = 0;
  const rifleGeoms = [];

  for (const part of bakedParts) {
    part.geometry.applyMatrix4(normMatrix);
    part.geometry.computeBoundingBox();
    part.geometry.computeVertexNormals();
    boxesByPart[part.name] = boxesByPart[part.name]
      ? boxesByPart[part.name].clone().union(part.geometry.boundingBox)
      : part.geometry.boundingBox.clone();

    if (part.name.includes('Legs')) {
      const pos = part.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < 0.14) {
          const x = pos.getX(i);
          if (x >= 0) {
            leftFootSumX += x;
            leftFootCount++;
          } else {
            rightFootSumX += x;
            rightFootCount++;
          }
        }
      }
    }

    if (part.name.includes('gaussrifle')) {
      rifleGeoms.push(part.geometry);
    }
  }

  const { muzzlePoint, barrelDir } = computeRifleMuzzle(rifleGeoms);

  const leftBootX = leftFootCount > 0 ? leftFootSumX / leftFootCount : 0.16;
  const rightBootX = rightFootCount > 0 ? rightFootSumX / rightFootCount : -0.16;
  const splitX = (leftBootX + rightBootX) * 0.5;

  const helmetBox = boxesByPart['Cube.023_AdvPowerArmorHelmet_0'] || new THREE.Box3(
    new THREE.Vector3(-0.15, 1.56, -0.12),
    new THREE.Vector3(0.15, 2.0, 0.16)
  );
  const helmetCenter = new THREE.Vector3();
  helmetBox.getCenter(helmetCenter);

  // 13-Bone Skeleton:
  // 0: root
  // 1: pelvis
  // 2: spine
  // 3: head
  // 4: arms
  // 5: leftThigh   (y=0.92)
  // 6: leftKnee    (y=0.56, rigid kneecap pivot!)
  // 7: leftShin    (y=0.55)
  // 8: leftFoot    (y=0.11, ankle pivot!)
  // 9: rightThigh  (y=0.92)
  // 10: rightKnee  (y=0.56, rigid kneecap pivot!)
  // 11: rightShin  (y=0.55)
  // 12: rightFoot  (y=0.11, ankle pivot!)
  const rootBone = new THREE.Bone();
  rootBone.name = 'root';

  const pelvisBone = new THREE.Bone();
  pelvisBone.name = 'pelvis';
  pelvisBone.position.set(splitX, 0.94, 0.0);
  rootBone.add(pelvisBone);

  const spineBone = new THREE.Bone();
  spineBone.name = 'spine';
  spineBone.position.set(0, 0.16, 0.0); // world y = 1.10
  pelvisBone.add(spineBone);

  const headBone = new THREE.Bone();
  headBone.name = 'head';
  headBone.position.set(helmetCenter.x - splitX, Math.max(1.52, helmetBox.min.y) - 1.10, helmetCenter.z);
  spineBone.add(headBone);

  const armsBone = new THREE.Bone();
  armsBone.name = 'arms';
  armsBone.position.set(0, 1.40 - 1.10, 0.02); // world y = 1.40
  spineBone.add(armsBone);

  const leftThighBone = new THREE.Bone();
  leftThighBone.name = 'leftThigh';
  leftThighBone.position.set(leftBootX * 0.8 - splitX, -0.02, 0.0); // world y = 0.92
  pelvisBone.add(leftThighBone);

  const leftKneeBone = new THREE.Bone();
  leftKneeBone.name = 'leftKnee';
  leftKneeBone.position.set(0.015, -0.36, 0.01); // world y = 0.56
  leftThighBone.add(leftKneeBone);

  const leftShinBone = new THREE.Bone();
  leftShinBone.name = 'leftShin';
  leftShinBone.position.set(0.015, -0.37, 0.0); // world y = 0.55
  leftThighBone.add(leftShinBone);

  const leftFootBone = new THREE.Bone();
  leftFootBone.name = 'leftFoot';
  leftFootBone.position.set(0.01, -0.44, 0.0); // world y = 0.11
  leftShinBone.add(leftFootBone);

  const rightThighBone = new THREE.Bone();
  rightThighBone.name = 'rightThigh';
  rightThighBone.position.set(rightBootX * 0.8 - splitX, -0.02, 0.0); // world y = 0.92
  pelvisBone.add(rightThighBone);

  const rightKneeBone = new THREE.Bone();
  rightKneeBone.name = 'rightKnee';
  rightKneeBone.position.set(-0.015, -0.36, 0.01); // world y = 0.56
  rightThighBone.add(rightKneeBone);

  const rightShinBone = new THREE.Bone();
  rightShinBone.name = 'rightShin';
  rightShinBone.position.set(-0.015, -0.37, 0.0); // world y = 0.55
  rightThighBone.add(rightShinBone);

  const rightFootBone = new THREE.Bone();
  rightFootBone.name = 'rightFoot';
  rightFootBone.position.set(-0.01, -0.44, 0.0); // world y = 0.11
  rightShinBone.add(rightFootBone);

  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.name = 'muzzleAnchor';
  muzzleAnchor.position.set(
    muzzlePoint.x - splitX,
    muzzlePoint.y - 1.40,
    muzzlePoint.z - 0.02
  );
  armsBone.add(muzzleAnchor);

  const muzzleTarget = new THREE.Object3D();
  muzzleTarget.name = 'muzzleTarget';
  muzzleTarget.position.copy(muzzleAnchor.position).add(barrelDir);
  armsBone.add(muzzleTarget);

  const bones = [
    rootBone,       // 0
    pelvisBone,     // 1
    spineBone,      // 2
    headBone,       // 3
    armsBone,       // 4
    leftThighBone,  // 5
    leftKneeBone,   // 6
    leftShinBone,   // 7
    leftFootBone,   // 8
    rightThighBone, // 9
    rightKneeBone,  // 10
    rightShinBone,  // 11
    rightFootBone   // 12
  ];

  const characterGroup = new THREE.Group();
  characterGroup.name = 'EnclaveSoldierRig';
  characterGroup.add(rootBone);

  rootBone.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  let eyeMaterial = null;
  let glowMaterial = null;
  let glassMaterial = null;

  for (const part of bakedParts) {
    const geom = part.geometry;
    const pos = geom.attributes.position;
    const count = pos.count;
    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);

    const name = part.name;
    const needsComponents = name.includes('Legs') || name.includes('Chest');
    const compData = needsComponents ? analyzeComponents(geom) : null;

    // Pre-classify each armor island into a rigid bone assignment
    const compAssignment = new Map();
    if (compData && name.includes('Legs')) {
      for (const [rootId, st] of compData.stats.entries()) {
        const isLeft = st.avgX >= splitX;
        const thighIdx = isLeft ? 5 : 9;
        const kneeIdx = isLeft ? 6 : 10;
        const shinIdx = isLeft ? 7 : 11;
        const footIdx = isLeft ? 8 : 12;

        if (st.minY < 0.14 && st.maxY < 0.28) {
          // Rigid boot & ankle guard
          compAssignment.set(rootId, { type: 'rigid', bone: footIdx });
        } else if (st.minY < 0.42 && st.maxY < 0.59) {
          // Rigid shin armor (greave)
          compAssignment.set(rootId, { type: 'rigid', bone: shinIdx });
        } else if (st.minY >= 0.40 && st.maxY < 0.72) {
          // Rigid kneecap plate -> bound 100% to knee bone so it NEVER stretches!
          compAssignment.set(rootId, { type: 'rigid', bone: kneeIdx });
        } else {
          // Upper thigh plate -> thigh transitioning smoothly to pelvis inside hip skirt
          compAssignment.set(rootId, { type: 'thigh', bone: thighIdx });
        }
      }
    } else if (compData && name.includes('Chest')) {
      for (const [rootId, st] of compData.stats.entries()) {
        if (st.maxY < 1.24) {
          // Lower waist armor belt/skirt stays rigid with pelvis
          compAssignment.set(rootId, { type: 'rigid', bone: 1 });
        } else {
          // Main cuirass and pauldrons stay rigid with spine
          compAssignment.set(rootId, { type: 'rigid', bone: 2 });
        }
      }
    }

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      let idx = [0, 0, 0, 0];
      let w = [1, 0, 0, 0];

      if (name.includes('Helmet') || name.includes('Eyes')) {
        idx = [3, 2, 0, 0];
        w = [1, 0, 0, 0];
      } else if (name.includes('Arms') || name.includes('gaussrifle') || name.includes('glass')) {
        idx = [4, 2, 0, 0];
        w = [1, 0, 0, 0];
      } else if (name.includes('OrangeGlow')) {
        idx = [2, 1, 0, 0];
        w = [1, 0, 0, 0];
      } else if (name.includes('Chest') && compData) {
        const rule = compAssignment.get(compData.rootOfVertex[i]);
        idx = [rule ? rule.bone : 2, 0, 0, 0];
        w = [1, 0, 0, 0];
      } else if (name.includes('Legs') && compData) {
        const rule = compAssignment.get(compData.rootOfVertex[i]);
        if (rule && rule.type === 'rigid') {
          idx = [rule.bone, 0, 0, 0];
          w = [1, 0, 0, 0];
        } else {
          const thighIdx = rule ? rule.bone : (x >= splitX ? 5 : 9);
          const pelvisBlend = smoothstep(0.92, 1.03, y);
          idx = [thighIdx, 1, 0, 0];
          w = [1 - pelvisBlend, pelvisBlend, 0, 0];
        }
      } else if (name.includes('fabric')) {
        // Elastic undersuit bends smoothly at all joints under the rigid armor plates
        if (y > 1.48) {
          const headBlend = smoothstep(1.48, 1.60, y);
          idx = [3, 2, 0, 0];
          w = [headBlend, 1 - headBlend, 0, 0];
        } else if (y > 0.98) {
          const armLateral = smoothstep(0.19, 0.29, Math.abs(x - splitX));
          const armForward = smoothstep(0.15, 0.25, z) * smoothstep(1.06, 1.24, y);
          const armBlend = Math.max(armLateral, armForward) * smoothstep(0.98, 1.15, y);
          const chestBlend = smoothstep(0.98, 1.10, y);
          idx = [4, 2, 1, 0];
          w = [armBlend, (1 - armBlend) * chestBlend, (1 - armBlend) * (1 - chestBlend), 0];
        } else {
          const isLeft = x >= splitX;
          const thighIdx = isLeft ? 5 : 9;
          const shinIdx = isLeft ? 7 : 11;
          const footIdx = isLeft ? 8 : 12;

          if (y < 0.16) {
            const footBlend = smoothstep(0.16, 0.08, y);
            idx = [footIdx, shinIdx, 0, 0];
            w = [footBlend, 1 - footBlend, 0, 0];
          } else if (y < 0.64) {
            const thighBlend = smoothstep(0.48, 0.62, y);
            idx = [thighIdx, shinIdx, 0, 0];
            w = [thighBlend, 1 - thighBlend, 0, 0];
          } else {
            const pelvisBlend = smoothstep(0.86, 0.99, y);
            idx = [1, thighIdx, 0, 0];
            w = [pelvisBlend, 1 - pelvisBlend, 0, 0];
          }
        }
      } else {
        idx = [2, 0, 0, 0];
        w = [1, 0, 0, 0];
      }

      normalizeWeights(w);

      const base = i * 4;
      skinIndices[base] = idx[0];
      skinIndices[base + 1] = idx[1];
      skinIndices[base + 2] = idx[2];
      skinIndices[base + 3] = idx[3];

      skinWeights[base] = w[0];
      skinWeights[base + 1] = w[1];
      skinWeights[base + 2] = w[2];
      skinWeights[base + 3] = w[3];
    }

    geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    const mat = Array.isArray(part.material) ? part.material[0] : part.material;
    if (mat) {
      if (name.includes('Eyes')) {
        eyeMaterial = mat;
        mat.emissiveIntensity = 2.5;
      } else if (name.includes('OrangeGlow')) {
        glowMaterial = mat;
        mat.emissiveIntensity = 2.6;
      } else if (name.includes('glass')) {
        glassMaterial = mat;
        mat.transparent = true;
        mat.opacity = 0.72;
        mat.roughness = 0.12;
        mat.metalness = 0.35;
      } else {
        mat.envMapIntensity = 1.28;
      }
    }

    const skinnedMesh = new THREE.SkinnedMesh(geom, part.material);
    skinnedMesh.name = name;
    skinnedMesh.castShadow = true;
    skinnedMesh.receiveShadow = true;
    skinnedMesh.frustumCulled = false;
    skinnedMesh.bind(skeleton);
    characterGroup.add(skinnedMesh);
  }

  return {
    group: characterGroup,
    skeleton,
    bones: {
      root: rootBone,
      pelvis: pelvisBone,
      spine: spineBone,
      head: headBone,
      arms: armsBone,
      leftThigh: leftThighBone,
      leftKnee: leftKneeBone,
      leftShin: leftShinBone,
      leftFoot: leftFootBone,
      rightThigh: rightThighBone,
      rightKnee: rightKneeBone,
      rightShin: rightShinBone,
      rightFoot: rightFootBone
    },
    muzzleAnchor,
    muzzleTarget,
    materials: {
      eye: eyeMaterial,
      glow: glowMaterial,
      glass: glassMaterial
    },
    restPose: {
      pelvisPos: pelvisBone.position.clone()
    }
  };
}
