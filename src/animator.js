import * as THREE from 'three';

const _vAxisY = new THREE.Vector3(0, 1, 0);
const _vAxisX = new THREE.Vector3(1, 0, 0);
const _vAxisZ = new THREE.Vector3(0, 0, 1);
const _qParent = new THREE.Quaternion();
const _qGroupInv = new THREE.Quaternion();
const _qParentLocal = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();
const _qPart = new THREE.Quaternion();
const _qLocalDelta = new THREE.Quaternion();

export class EnclaveAnimator {
  constructor(rig, callbacks = {}) {
    this.rig = rig;
    this.onFootstep = callbacks.onFootstep || (() => {});
    this.onGaussFireMoment = callbacks.onGaussFireMoment || (() => {});
    this.onReloadStep = callbacks.onReloadStep || (() => {});
    this.reloadStepMask = 0;

    this.state = 'idle'; // idle | walk | fire | salute | scan | inspect | dragged | land | sleep
    this.time = 0;
    this.actionTimer = 0;
    this.walkPhase = 0;
    this.prevStepBucket = 0;
    this.firedThisCycle = false;
    this.nextIdleMicroTime = 9 + Math.random() * 6;

    this.targetFacingYaw = -0.14;
    this.cursorAimYaw = 0;
    this.cursorAimPitch = 0;
    this.dragVelX = 0;
    this.dragVelY = 0;

    // FNV native AnimationClip mixer setup
    if (rig.isFnvClipRig && rig.clips && rig.clips.size > 0) {
      this.isClipMode = true;
      this.mixer = new THREE.AnimationMixer(rig.group);
      this.actions = new Map();
      this.actionWeights = new Map();
      const looping = new Set(['idle', 'walk', 'walk_fast', 'jump_loop']);
      for (const [name, clip] of rig.clips.entries()) {
        const action = this.mixer.clipAction(clip);
        if (looping.has(name)) {
          action.setLoop(THREE.LoopRepeat, Infinity);
        } else {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        const initW = name === 'idle' ? 1 : 0;
        action.enabled = true;
        action.setEffectiveWeight(initW);
        if (initW > 0 || looping.has(name)) action.play();
        this.actions.set(name, action);
        this.actionWeights.set(name, initW);
      }
      this.activeClipName = 'idle';
      this.clipFadeSpeed = 12;
      this.prevWalkFrac = 0;
      this.fireClipStarted = false;
      this.fnvSmooth = {
        rootYaw: -0.14,
        rootTiltZ: 0,
        cursorYaw: 0,
        cursorPitch: 0,
        eyeIntensity: 2.6,
        glowIntensity: 2.6
      };
    }

    const restPelvis = rig.restPose?.pelvisPos || new THREE.Vector3();
    this.current = {
      rootYaw: -0.14,
      rootTiltZ: 0,
      pelvisX: restPelvis.x,
      pelvisY: restPelvis.y,
      pelvisZ: restPelvis.z,
      pelvisRotX: 0,
      pelvisRotY: 0,
      pelvisRotZ: 0,
      spineRotX: 0,
      spineRotY: 0,
      spineRotZ: 0,
      headRotX: 0,
      headRotY: 0,
      headRotZ: 0,
      armsRotX: 0,
      armsRotY: 0,
      armsRotZ: 0,
      lThighX: 0,
      lThighZ: 0,
      lShinX: 0,
      lFootX: 0,
      rThighX: 0,
      rThighZ: 0,
      rShinX: 0,
      rFootX: 0,
      eyeIntensity: 2.5,
      glowIntensity: 2.6
    };
  }

  setFireBurst(count = 1, interval = 0.18, windup = 0.34) {
    this.burstCount = Math.max(1, Math.min(5, Math.round(count)));
    this.burstInterval = Math.max(0.10, interval);
    this.fireWindup = Math.max(0.10, windup);
  }

  setState(nextState) {
    if (
      this.state === nextState &&
      nextState !== 'fire' &&
      nextState !== 'salute' &&
      nextState !== 'scan' &&
      nextState !== 'inspect'
    ) {
      return;
    }
    this.state = nextState;
    this.actionTimer = 0;
    this.firedThisCycle = false;
    this.fireClipStarted = false;
    this.shotsFired = 0;
    this.reloadStepMask = 0;

    if (this.isClipMode) {
      if (nextState === 'idle') this.playClip('idle', 0.24);
      else if (nextState === 'walk') this.playClip('walk', 0.18, true);
      else if (nextState === 'fire') this.playClip('fire', 0.10, true);
      else if (nextState === 'inspect') this.playClip('inspect', 0.20, true);
      else if (nextState === 'scan') this.playClip('scan', 0.24, true);
      else if (nextState === 'salute') this.playClip('salute', 0.20, true);
      else if (nextState === 'dragged') this.playClip('jump_loop', 0.15, true);
      else if (nextState === 'land') this.playClip('idle', 0.12);
      else if (nextState === 'sleep') this.playClip('idle', 0.35);
    }
  }

  playClip(name, fadeSec = 0.2, restart = false) {
    const nextAction = this.actions?.get(name);
    if (!nextAction) return;

    this.clipFadeSpeed = Math.max(4, 2.8 / Math.max(0.04, fadeSec));
    if (restart) nextAction.reset();
    nextAction.enabled = true;
    nextAction.setEffectiveTimeScale(name === 'walk' ? 1.12 : 1.0);
    nextAction.play();

    const walkFast = this.actions.get('walk_fast');
    if (name === 'walk' && walkFast) {
      walkFast.reset();
      walkFast.enabled = true;
      walkFast.setEffectiveTimeScale(1.12 * (0.80 / 1.20));
      walkFast.play();
    }

    this.activeClipName = name;
  }

  blendClipWeights(dt) {
    const fadeAlpha = 1 - Math.exp(-this.clipFadeSpeed * dt);
    let total = 0;
    for (const [name, action] of this.actions.entries()) {
      let targetW = 0;
      if (this.activeClipName === 'walk') {
        if (name === 'walk') targetW = 0.68;
        else if (name === 'walk_fast') targetW = 0.32;
      } else if (name === this.activeClipName) {
        targetW = 1;
      }
      const prevW = this.actionWeights.get(name) ?? 0;
      const w = prevW + (targetW - prevW) * fadeAlpha;
      this.actionWeights.set(name, w);
      total += w;
      if (w > 0.001) {
        action.enabled = true;
        action.setEffectiveWeight(w);
      } else {
        action.setEffectiveWeight(0);
      }
    }
    if (total > 1e-4 && Math.abs(total - 1) > 1e-3) {
      for (const [name, action] of this.actions.entries()) {
        const w = (this.actionWeights.get(name) ?? 0) / total;
        this.actionWeights.set(name, w);
        action.setEffectiveWeight(w);
      }
    }
  }

  applyCharSpaceRot(bone, yawY, pitchX, rollZ = 0) {
    if (!bone || !bone.parent) return;
    if (Math.abs(yawY) < 1e-4 && Math.abs(pitchX) < 1e-4 && Math.abs(rollZ) < 1e-4) return;

    bone.parent.updateWorldMatrix(true, false);
    bone.parent.getWorldQuaternion(_qParent);
    _qGroupInv.copy(this.rig.group.quaternion).invert();
    _qParentLocal.multiplyQuaternions(_qGroupInv, _qParent);

    _qDelta.setFromAxisAngle(_vAxisY, yawY);
    if (Math.abs(pitchX) >= 1e-4) {
      _qPart.setFromAxisAngle(_vAxisX, pitchX);
      _qDelta.multiply(_qPart);
    }
    if (Math.abs(rollZ) >= 1e-4) {
      _qPart.setFromAxisAngle(_vAxisZ, rollZ);
      _qDelta.multiply(_qPart);
    }

    _qLocalDelta.copy(_qParentLocal).invert().multiply(_qDelta).multiply(_qParentLocal);
    bone.quaternion.premultiply(_qLocalDelta).normalize();
  }

  updateFnvClips(dt) {
    const s = this.fnvSmooth;
    let targetYaw = this.targetFacingYaw;
    let targetTiltZ = 0;
    let targetEye = 2.6;
    let targetGlow = 2.6 + Math.sin(this.time * 2.8) * 0.35;
    let addHeadYaw = 0;
    let addHeadPitch = 0;
    let addSpineYaw = 0;
    let addSpinePitch = 0;
    let addPelvisY = 0;
    let addLegBend = 0;

    if (this.state === 'idle') {
      const breath = Math.sin(this.time * 1.85);
      addSpineYaw = this.cursorAimYaw * 0.20;
      addSpinePitch = breath * 0.016;
      addHeadYaw = this.cursorAimYaw * 0.52;
      addHeadPitch = this.cursorAimPitch * 0.42 - breath * 0.015;
      this.actions.get('idle')?.setEffectiveTimeScale(1.0);

      if (this.time >= this.nextIdleMicroTime) {
        this.nextIdleMicroTime = this.time + 11 + Math.random() * 7;
        this.setState('inspect');
      }
    } else if (this.state === 'walk') {
      const walkAct = this.actions.get('walk');
      const walkFast = this.actions.get('walk_fast');
      if (walkAct) {
        const curFrac = (walkAct.time / 1.20) % 1.0;
        if (walkFast) {
          walkFast.time = curFrac * 0.80;
        }
        // Sync footsteps cleanly to FNV's Left (0.31) and Right (0.86) keys
        const crossed = (mark) =>
          (this.prevWalkFrac < mark && curFrac >= mark) ||
          (curFrac < this.prevWalkFrac && (curFrac >= mark || this.prevWalkFrac < mark));
        if (crossed(0.31) || crossed(0.86)) {
          this.onFootstep();
        }
        this.prevWalkFrac = curFrac;
      }
      addHeadYaw = this.cursorAimYaw * 0.25;
      addHeadPitch = this.cursorAimPitch * 0.20;
    } else if (this.state === 'fire') {
      const a = this.actionTimer;
      const windup = this.fireWindup || 0.34;
      targetYaw = Math.max(-0.42, Math.min(0.42, this.cursorAimYaw * 0.55));
      const aimPitch = Math.max(-0.22, Math.min(0.10, this.cursorAimPitch * 0.22));
      if (a < windup) {
        const k = Math.min(1, a / windup);
        const smooth = k * k * (3 - 2 * k);
        targetEye = 2.6 + k * 2.6;
        targetGlow = 2.6 + k * 3.2;
        addSpinePitch = aimPitch * smooth + (k > 0.5 ? Math.sin(a * 95) * 0.01 * k : 0);
        addHeadYaw = this.cursorAimYaw * 0.25;
        addHeadPitch = aimPitch * smooth * 0.8;
      } else {
        const f = a - windup;
        const burstEnd = windup + (this.burstCount - 1) * this.burstInterval;
        const afterLast = Math.max(0, a - burstEnd);
        const holdLift = Math.max(0, 1 - afterLast * 1.15);
        addSpinePitch = aimPitch * holdLift;
        addHeadYaw = this.cursorAimYaw * 0.22 * holdLift;
        addHeadPitch = aimPitch * holdLift * 0.8;

        // Evaluate current fire pose & aim BEFORE firing each shot
        const targetShot = Math.min(this.burstCount - 1, Math.floor(f / this.burstInterval));
        if (this.shotsFired <= targetShot) {
          this.blendClipWeights(dt);
          this.mixer.update(dt);
          const bPre = this.rig.bipBones;
          if (bPre) {
            this.applyCharSpaceRot(bPre.spine2, 0, addSpinePitch, 0);
            this.applyCharSpaceRot(bPre.head, addHeadYaw, addHeadPitch, 0);
          }
          while (this.shotsFired <= targetShot) {
            const isFollowUp = this.shotsFired > 0;
            this.shotsFired++;
            this.onGaussFireMoment();
            if (isFollowUp) {
              const fireAct = this.actions.get('fire');
              if (fireAct) {
                fireAct.time = Math.min(fireAct.time, 0.14);
                fireAct.play();
              }
            }
          }
          return;
        }

        const endTime = burstEnd + 0.96;
        targetEye = Math.max(2.6, 5.2 - afterLast * 2.6);
        targetGlow = Math.max(2.6, 5.6 - afterLast * 3.0);
        if (a >= endTime) {
          this.setState('idle');
        }
      }
    } else if (this.state === 'inspect') {
      targetYaw = -0.20;
      const a = this.actionTimer;
      if (!(this.reloadStepMask & 1) && a >= 0.23) { this.reloadStepMask |= 1; this.onReloadStep('out'); }
      if (!(this.reloadStepMask & 2) && a >= 0.67) { this.reloadStepMask |= 2; this.onReloadStep('in'); }
      if (!(this.reloadStepMask & 4) && a >= 1.63) { this.reloadStepMask |= 4; this.onReloadStep('chamber'); }
      const focus = Math.sin(Math.min(1, a / 2.20) * Math.PI);
      targetEye = 2.6 + focus * 1.1;
      targetGlow = 2.7 + focus * 1.1;
      if (a >= 2.20) {
        this.setState('idle');
      }
    } else if (this.state === 'scan') {
      targetYaw = 0;
      targetEye = 3.6 + Math.sin(this.actionTimer * 15) * 0.55;
      if (this.actionTimer >= 4.9) {
        this.setState('idle');
      }
    } else if (this.state === 'salute') {
      targetYaw = 0;
      targetEye = 3.4;
      if (this.actionTimer >= 1.67) {
        this.setState('idle');
      }
    } else if (this.state === 'dragged') {
      targetYaw = 0;
      targetTiltZ = Math.max(-0.34, Math.min(0.34, -this.dragVelX * 0.016));
      addHeadYaw = targetTiltZ * 1.1;
      addHeadPitch = 0.14;
      targetEye = 3.6;
    } else if (this.state === 'land') {
      const a = this.actionTimer;
      if (a < 0.48) {
        const p = a / 0.48;
        const impact = Math.sin(p * Math.PI) * (1 - p * 0.25);
        addPelvisY = -0.17 * impact;
        addLegBend = 0.65 * impact;
        addSpinePitch = 0.20 * impact;
        addHeadPitch = 0.14 * impact;
      } else {
        this.setState('idle');
      }
    } else if (this.state === 'sleep') {
      targetYaw = -0.08;
      this.actions.get('idle')?.setEffectiveTimeScale(0.25);
      addPelvisY = -0.03;
      addSpinePitch = 0.12 + Math.sin(this.time * 1.05) * 0.012;
      addHeadPitch = 0.34 + Math.sin(this.time * 1.05) * 0.02;
      targetEye = 0.32 + Math.sin(this.time * 1.8) * 0.22;
      targetGlow = 0.9 + Math.sin(this.time * 1.4) * 0.28;
    }

    const sm = 1 - Math.exp(-12 * dt);
    s.rootYaw += (targetYaw - s.rootYaw) * sm;
    s.rootTiltZ += (targetTiltZ - s.rootTiltZ) * sm;
    s.cursorYaw += (addHeadYaw - s.cursorYaw) * sm;
    s.cursorPitch += (addHeadPitch - s.cursorPitch) * sm;
    s.eyeIntensity += (targetEye - s.eyeIntensity) * sm;
    s.glowIntensity += (targetGlow - s.glowIntensity) * sm;

    this.rig.group.rotation.y = s.rootYaw;
    this.rig.group.rotation.z = s.rootTiltZ;

    // 1. Evaluate genuine Fallout: New Vegas .kf animation frame
    this.blendClipWeights(dt);
    this.mixer.update(dt);

    // 2. Apply clean character-space additive responsiveness (never mutating bind rest!)
    const b = this.rig.bipBones;
    if (b) {
      if (Math.abs(addPelvisY) > 1e-4 && b.nonAccum) {
        b.nonAccum.position.y += addPelvisY;
      }
      if (Math.abs(addLegBend) > 1e-4) {
        this.applyCharSpaceRot(b.leftThigh, 0, -addLegBend * 0.58, 0);
        this.applyCharSpaceRot(b.rightThigh, 0, -addLegBend * 0.58, 0);
        this.applyCharSpaceRot(b.leftCalf, 0, addLegBend * 1.12, 0);
        this.applyCharSpaceRot(b.rightCalf, 0, addLegBend * 1.12, 0);
      }
      this.applyCharSpaceRot(b.spine2, addSpineYaw, addSpinePitch, 0);
      this.applyCharSpaceRot(b.head, s.cursorYaw, s.cursorPitch, -s.cursorYaw * 0.12);
    }

    if (this.rig.materials.eye) {
      this.rig.materials.eye.emissiveIntensity = s.eyeIntensity;
    }
    if (this.rig.materials.glow) {
      this.rig.materials.glow.emissiveIntensity = s.glowIntensity;
    }
  }

  setCursorAim(yaw, pitch) {
    this.cursorAimYaw = Math.max(-0.75, Math.min(0.75, yaw));
    this.cursorAimPitch = Math.max(-0.45, Math.min(0.45, pitch));
  }

  setWalkDirection(dir) {
    // Keep yaw moderate (+-0.46 rad) so the Gauss rifle never clips at window edges
    if (dir > 0) this.targetFacingYaw = 0.46;
    else if (dir < 0) this.targetFacingYaw = -0.46;
    else this.targetFacingYaw = -0.14;
  }

  setDragVelocity(vx, vy = 0) {
    this.dragVelX = Math.max(-24, Math.min(24, vx));
    this.dragVelY = Math.max(-24, Math.min(24, vy));
  }

  update(dt) {
    this.time += dt;
    this.actionTimer += dt;

    if (this.isClipMode) {
      this.updateFnvClips(dt);
      return;
    }

    const rest = this.rig.restPose.pelvisPos;
    const t = {
      rootYaw: this.targetFacingYaw,
      rootTiltZ: 0,
      pelvisX: rest.x,
      pelvisY: rest.y,
      pelvisZ: rest.z,
      pelvisRotX: 0,
      pelvisRotY: 0,
      pelvisRotZ: 0,
      spineRotX: 0,
      spineRotY: 0,
      spineRotZ: 0,
      headRotX: 0,
      headRotY: 0,
      headRotZ: 0,
      armsRotX: 0,
      armsRotY: 0,
      armsRotZ: 0,
      lThighX: 0,
      lThighZ: 0.015,
      lShinX: 0.04,
      lFootX: -0.04,
      rThighX: 0,
      rThighZ: -0.015,
      rShinX: 0.04,
      rFootX: -0.04,
      eyeIntensity: 2.5,
      glowIntensity: 2.5 + Math.sin(this.time * 2.8) * 0.35
    };

    let lerpSpeed = 10;

    if (this.state === 'idle') {
      const breath = Math.sin(this.time * 1.85);
      const breathDelayed = Math.sin(this.time * 1.85 - 0.55);
      const shift = Math.sin(this.time * 0.55);

      // Weight shifting smoothly from left leg to right leg with grounded feet
      t.pelvisX = rest.x + shift * 0.022;
      t.pelvisY = rest.y - 0.012 + breath * 0.006 - Math.abs(shift) * 0.008;
      t.pelvisRotZ = -shift * 0.024;
      t.pelvisRotY = shift * 0.03;

      // Knee micro-flex on relaxed leg while keeping boot flat on taskbar
      const leftFlex = Math.max(0, -shift) * 0.09 + 0.04;
      const rightFlex = Math.max(0, shift) * 0.09 + 0.04;
      t.lThighX = -leftFlex * 0.45;
      t.lShinX = leftFlex;
      t.lFootX = -(t.lThighX + t.lShinX);

      t.rThighX = -rightFlex * 0.45;
      t.rShinX = rightFlex;
      t.rFootX = -(t.rThighX + t.rShinX);

      // Torso & weapon breathing + subtle tracking toward cursor
      t.spineRotX = 0.02 + breath * 0.022;
      t.spineRotY = this.cursorAimYaw * 0.22 - shift * 0.035;
      t.spineRotZ = shift * 0.015;

      t.armsRotX = 0.02 + breathDelayed * 0.024;
      t.armsRotY = this.cursorAimYaw * 0.12;

      const glance = Math.sin(this.time * 0.42) * 0.06;
      t.headRotY = this.cursorAimYaw * 0.58 + glance - this.current.rootYaw * 0.35;
      t.headRotX = this.cursorAimPitch * 0.55 - breath * 0.02;
      t.headRotZ = -this.cursorAimYaw * 0.07;

      if (this.time >= this.nextIdleMicroTime) {
        this.nextIdleMicroTime = this.time + 11 + Math.random() * 8;
        this.setState('inspect');
      }
    } else if (this.state === 'inspect') {
      lerpSpeed = 8.5;
      const a = this.actionTimer;
      if (a < 2.2) {
        const lift = Math.sin(Math.min(1, a / 2.2) * Math.PI);
        const focus = Math.sin(Math.max(0, Math.min(1, (a - 0.35) / 1.4)) * Math.PI);
        t.pelvisY = rest.pelvisPos ? rest.pelvisPos.y : rest.y;
        t.pelvisY = rest.y - 0.015 * lift;
        t.spineRotX = 0.04 * lift;
        t.spineRotY = -0.14 * lift;
        t.armsRotX = -0.22 * lift;
        t.armsRotY = -0.18 * lift;
        t.armsRotZ = 0.08 * lift;
        t.headRotX = 0.17 * focus;
        t.headRotY = 0.16 * focus;
        t.headRotZ = -0.10 * focus;
        t.lShinX = 0.07;
        t.rShinX = 0.07;
        t.lFootX = -0.07;
        t.rFootX = -0.07;
        t.eyeIntensity = 2.6 + 1.2 * focus;
        t.glowIntensity = 2.8 + 1.1 * focus;
      } else {
        this.setState('idle');
      }
    } else if (this.state === 'walk') {
      lerpSpeed = 18;
      const walkFreq = 5.2;
      this.walkPhase += dt * walkFreq;
      const p = this.walkPhase;

      // Step sound triggered cleanly at heel-strike moments (p = k * PI)
      const stepBucket = Math.floor(p / Math.PI);
      if (stepBucket !== this.prevStepBucket) {
        this.prevStepBucket = stepBucket;
        this.onFootstep();
      }

      const computeStepLeg = (phase) => {
        const s = Math.sin(phase);
        const swing = Math.max(0, s);
        const earlyLift = Math.max(0, Math.sin(phase + 0.42));
        // High knee lift in swing + strong push-off in stance
        const thighX = -0.06 - 0.36 * s - 0.28 * swing * swing;
        const shinX = 0.06 + 0.92 * Math.pow(earlyLift, 1.25);
        const footX = -(thighX + shinX) * (1 - 0.32 * swing) + 0.16 * swing;
        return { thighX, shinX, footX };
      };

      const leftLeg = computeStepLeg(p);
      const rightLeg = computeStepLeg(p + Math.PI);

      t.lThighX = leftLeg.thighX;
      t.lShinX = leftLeg.shinX;
      t.lFootX = leftLeg.footX;

      t.rThighX = rightLeg.thighX;
      t.rShinX = rightLeg.shinX;
      t.rFootX = rightLeg.footX;

      // Highest on planted support leg (sin peaks), slight compression on foot-strike (sin=0)
      const stanceLift = Math.abs(Math.sin(p));
      t.pelvisY = rest.y - 0.022 + stanceLift * 0.048;
      t.pelvisX = rest.x + Math.cos(p) * 0.028;
      t.pelvisRotY = Math.cos(p) * 0.09;
      t.pelvisRotZ = Math.sin(p) * 0.038;

      // Counter-twist in upper torso + forward march lean
      t.spineRotX = 0.08 + Math.sin(p * 2) * 0.02;
      t.spineRotY = -Math.cos(p) * 0.11;
      t.spineRotZ = -Math.sin(p) * 0.024;

      // Stabilized combat rifle carry with subtle inertial bounce
      t.armsRotX = 0.05 + Math.sin(p * 2 - 0.55) * 0.035;
      t.armsRotY = -Math.cos(p) * 0.05;

      t.headRotY = this.cursorAimYaw * 0.28;
      t.headRotX = -0.05 + this.cursorAimPitch * 0.22;
    } else if (this.state === 'fire') {
      lerpSpeed = 24;
      const a = this.actionTimer;
      // Keep yaw bounded so firing never clips out of frame
      t.rootYaw = Math.max(-0.42, Math.min(0.42, this.cursorAimYaw * 0.55));

      if (a < 0.42) {
        // Brace stance + capacitor charge vibration
        const k = Math.min(1, a / 0.38);
        const ease = k * k * (3 - 2 * k);
        const jitter = k > 0.55 ? Math.sin(a * 95) * 0.012 * k : 0;

        t.pelvisY = rest.y - 0.075 * ease;
        t.lThighX = -0.22 * ease;
        t.lShinX = 0.36 * ease;
        t.lFootX = -(t.lThighX + t.lShinX);

        t.rThighX = 0.12 * ease;
        t.rShinX = 0.16 * ease;
        t.rFootX = -(t.rThighX + t.rShinX);

        t.spineRotX = 0.08 * ease;
        t.spineRotY = this.cursorAimYaw * 0.25 * ease;
        t.armsRotX = -0.18 * ease + this.cursorAimPitch * 0.32 + jitter;
        t.armsRotY = this.cursorAimYaw * 0.22;
        t.headRotX = -0.04 + this.cursorAimPitch * 0.32;
        t.headRotY = this.cursorAimYaw * 0.25;
        t.eyeIntensity = 2.5 + ease * 2.6;
        t.glowIntensity = 2.6 + ease * 3.4;
      } else if (a < 0.64) {
        // Electromagnetic recoil wave through arms -> spine -> head
        if (!this.firedThisCycle) {
          this.firedThisCycle = true;
          this.onGaussFireMoment();
        }
        const f = (a - 0.42) / 0.22;
        const kick = Math.sin(Math.min(1, f * 1.4) * Math.PI);
        const followKick = Math.sin(Math.max(0, f - 0.12) * Math.PI);

        t.pelvisY = rest.y - 0.085;
        t.pelvisZ = rest.z - 0.055 * kick;
        t.lThighX = -0.24;
        t.lShinX = 0.38;
        t.lFootX = -(t.lThighX + t.lShinX);
        t.rThighX = 0.14;
        t.rShinX = 0.18;
        t.rFootX = -(t.rThighX + t.rShinX);

        t.spineRotX = -0.17 * followKick;
        t.armsRotX = -0.36 * kick - 0.14;
        t.headRotX = -0.14 * followKick;
        t.eyeIntensity = 5.2;
        t.glowIntensity = 5.6;
      } else if (a < 1.35) {
        // Smooth hydraulic recovery
        const rec = (a - 0.64) / 0.71;
        const ease = 1 - Math.pow(1 - rec, 2.2);
        const inv = 1 - ease;

        t.pelvisY = rest.y - 0.075 * inv;
        t.lThighX = -0.22 * inv;
        t.lShinX = 0.36 * inv + 0.04;
        t.lFootX = -(t.lThighX + t.lShinX);
        t.rThighX = 0.12 * inv;
        t.rShinX = 0.16 * inv + 0.04;
        t.rFootX = -(t.rThighX + t.rShinX);

        t.armsRotX = -0.14 * inv;
        t.spineRotX = 0.04 * inv;
        t.eyeIntensity = 4.6 - 2.1 * ease;
        t.glowIntensity = 4.8 - 2.2 * ease;
      } else {
        this.setState('idle');
      }
    } else if (this.state === 'salute') {
      lerpSpeed = 12;
      const a = this.actionTimer;
      t.rootYaw = 0;
      if (a < 1.5) {
        const env = Math.sin(Math.min(1, a / 1.5) * Math.PI);
        const nod = a > 0.32 && a < 0.85 ? Math.sin(((a - 0.32) / 0.53) * Math.PI) : 0;
        t.pelvisY = rest.y + 0.015 * env;
        t.lThighZ = 0.005;
        t.rThighZ = -0.005;
        t.spineRotX = -0.07 * env;
        t.armsRotX = -0.26 * env;
        t.armsRotZ = -0.06 * env;
        t.headRotX = -0.04 * env + 0.14 * nod;
        t.eyeIntensity = 3.4;
      } else {
        this.setState('idle');
      }
    } else if (this.state === 'scan') {
      lerpSpeed = 9.5;
      const a = this.actionTimer;
      if (a < 2.2) {
        const env = Math.sin(Math.min(1, a / 2.2) * Math.PI);
        const sweep = Math.sin(a * Math.PI * 1.35);
        t.pelvisY = rest.y - 0.03 * env;
        t.lShinX = 0.14 * env + 0.04;
        t.rShinX = 0.14 * env + 0.04;
        t.lThighX = -0.07 * env;
        t.rThighX = -0.07 * env;
        t.lFootX = -(t.lThighX + t.lShinX);
        t.rFootX = -(t.rThighX + t.rShinX);

        t.spineRotY = sweep * 0.24;
        t.spineRotX = 0.05 * env;
        t.headRotY = sweep * 0.48;
        t.headRotX = -0.06;
        t.armsRotY = sweep * 0.20;
        t.armsRotX = -0.10 * env;
        t.eyeIntensity = 3.6 + Math.sin(a * 16) * 0.55;
      } else {
        this.setState('idle');
      }
    } else if (this.state === 'dragged') {
      lerpSpeed = 16;
      const kick = Math.sin(this.time * 9.5);
      const liftTuck = Math.max(-0.2, Math.min(0.25, -this.dragVelY * 0.015));

      t.rootYaw = 0;
      t.rootTiltZ = Math.max(-0.34, Math.min(0.34, -this.dragVelX * 0.016));
      t.pelvisY = rest.y - 0.03;

      t.lThighX = -0.24 + kick * 0.18 - liftTuck;
      t.lShinX = 0.42 + Math.max(0, -kick) * 0.22 + Math.max(0, liftTuck) * 0.5;
      t.lFootX = 0.18;

      t.rThighX = -0.18 - kick * 0.18 - liftTuck;
      t.rShinX = 0.38 + Math.max(0, kick) * 0.22 + Math.max(0, liftTuck) * 0.5;
      t.rFootX = 0.18;

      t.spineRotX = 0.09;
      t.armsRotX = -0.12 - liftTuck * 0.4;
      t.headRotX = 0.16;
      t.headRotY = t.rootTiltZ * 1.15;
      t.eyeIntensity = 3.6;
    } else if (this.state === 'land') {
      lerpSpeed = 24;
      const a = this.actionTimer;
      if (a < 0.5) {
        const p = a / 0.5;
        const impact = Math.sin(p * Math.PI) * (1 - p * 0.25);
        t.pelvisY = rest.y - 0.20 * impact;
        t.lThighX = -0.44 * impact;
        t.lShinX = 0.82 * impact + 0.04;
        t.lFootX = -(t.lThighX + t.lShinX);

        t.rThighX = -0.40 * impact;
        t.rShinX = 0.78 * impact + 0.04;
        t.rFootX = -(t.rThighX + t.rShinX);

        t.spineRotX = 0.22 * impact;
        t.armsRotX = 0.18 * impact;
        t.headRotX = 0.16 * impact;
      } else {
        this.setState('idle');
      }
    } else if (this.state === 'sleep') {
      lerpSpeed = 4.5;
      const breath = Math.sin(this.time * 1.05);
      t.rootYaw = -0.08;
      t.pelvisY = rest.y - 0.035 + breath * 0.004;
      t.spineRotX = 0.12 + breath * 0.014;
      t.headRotX = 0.34 + breath * 0.022;
      t.headRotY = 0.06;
      t.armsRotX = 0.16 + breath * 0.014;
      t.lThighX = -0.05;
      t.rThighX = -0.05;
      t.lShinX = 0.11;
      t.rShinX = 0.11;
      t.lFootX = -0.06;
      t.rFootX = -0.06;
      t.eyeIntensity = 0.32 + Math.sin(this.time * 1.8) * 0.22;
      t.glowIntensity = 0.9 + Math.sin(this.time * 1.4) * 0.28;
    }

    const alpha = 1 - Math.exp(-lerpSpeed * dt);
    const c = this.current;
    for (const key of Object.keys(c)) {
      c[key] += (t[key] - c[key]) * alpha;
    }

    const b = this.rig.bones;
    this.rig.group.rotation.y = c.rootYaw;
    this.rig.group.rotation.z = c.rootTiltZ;

    b.pelvis.position.set(c.pelvisX, c.pelvisY, c.pelvisZ);
    b.pelvis.rotation.set(c.pelvisRotX, c.pelvisRotY, c.pelvisRotZ);

    b.spine.rotation.set(c.spineRotX, c.spineRotY, c.spineRotZ);
    b.head.rotation.set(c.headRotX, c.headRotY, c.headRotZ);
    b.arms.rotation.set(c.armsRotX, c.armsRotY, c.armsRotZ);

    b.leftThigh.rotation.set(c.lThighX, 0, c.lThighZ);
    b.leftKnee.rotation.set(c.lShinX * 0.52, 0, 0);
    b.leftShin.rotation.set(c.lShinX, 0, 0);
    b.leftFoot.rotation.set(c.lFootX, 0, 0);

    b.rightThigh.rotation.set(c.rThighX, 0, c.rThighZ);
    b.rightKnee.rotation.set(c.rShinX * 0.52, 0, 0);
    b.rightShin.rotation.set(c.rShinX, 0, 0);
    b.rightFoot.rotation.set(c.rFootX, 0, 0);

    if (this.rig.materials.eye) {
      this.rig.materials.eye.emissiveIntensity = c.eyeIntensity;
    }
    if (this.rig.materials.glow) {
      this.rig.materials.glow.emissiveIntensity = c.glowIntensity;
    }
  }
}
