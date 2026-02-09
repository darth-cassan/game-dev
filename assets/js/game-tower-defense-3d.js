(function () {
  const stage = document.getElementById("gameStage");
  const overlay = document.getElementById("gameOverlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const livesLabel = document.getElementById("livesLabel");
  const moneyLabel = document.getElementById("moneyLabel");
  const waveLabel = document.getElementById("waveLabel");
  const remainingLabel = document.getElementById("remainingLabel");
  const hintLabel = document.getElementById("hintLabel");

  const buildBasicBtn = document.getElementById("buildBasicBtn");
  const buildRapidBtn = document.getElementById("buildRapidBtn");
  const startWaveBtn = document.getElementById("startWaveBtn");
  const cancelBuildBtn = document.getElementById("cancelBuildBtn");

  const GRID_COLS = 12;
  const GRID_ROWS = 8;
  const TILE = 2;

  const state = {
    lives: 20,
    money: 132,
    wave: 0,
    waveActive: false,
    buildMode: null,
    spawning: false,
    enemiesToSpawn: 0,
    spawnTimer: 0,
    autoNextWaveAt: 0,
    gameOver: false,
  };

  const towerTypes = {
    basic: {
      id: "basic",
      cost: 55,
      color: 0xdc143c,
      range: 4.8,
      fireCooldown: 0.85,
      damage: 15,
      bulletSpeed: 16,
      label: "Torre Cañón",
    },
    rapid: {
      id: "rapid",
      cost: 90,
      color: 0x6fe8ff,
      range: 4.3,
      fireCooldown: 0.4,
      damage: 9,
      bulletSpeed: 22,
      label: "Torre Rápida",
    },
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1018);

  const camera = new THREE.PerspectiveCamera(58, stage.clientWidth / stage.clientHeight, 0.1, 140);
  camera.position.set(0, 20, 17);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  stage.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x1c2438, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(8, 14, 7);
  scene.add(dirLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID_COLS * TILE, GRID_ROWS * TILE),
    new THREE.MeshStandardMaterial({ color: 0x182130, roughness: 0.95, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const gridLines = new THREE.GridHelper(GRID_COLS * TILE, GRID_COLS, 0x3a4256, 0x2b3344);
  gridLines.position.y = 0.01;
  scene.add(gridLines);

  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        Array.from({ length: 650 }, () => (Math.random() - 0.5) * 170),
        3
      )
    ),
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.22 })
  );
  scene.add(stars);

  function cellToWorld(col, row) {
    const x = (col - GRID_COLS / 2 + 0.5) * TILE;
    const z = (row - GRID_ROWS / 2 + 0.5) * TILE;
    return new THREE.Vector3(x, 0, z);
  }

  const pathCells = [
    [0, 3], [1, 3], [2, 3], [3, 3], [3, 4], [3, 5], [4, 5], [5, 5], [6, 5], [6, 4], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],
  ];

  const pathSet = new Set(pathCells.map((c) => `${c[0]},${c[1]}`));
  const pathWaypoints = pathCells.map(([col, row]) => cellToWorld(col, row));

  const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xff5a7a, emissive: 0x2b0c16, roughness: 0.55 });
  for (let i = 0; i < pathCells.length; i += 1) {
    const [col, row] = pathCells[i];
    const tile = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.92, 0.15, TILE * 0.92), pathMaterial);
    const w = cellToWorld(col, row);
    tile.position.set(w.x, 0.08, w.z);
    scene.add(tile);
  }

  const startMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.26, 24),
    new THREE.MeshStandardMaterial({ color: 0x5bff8c, emissive: 0x10321e })
  );
  const startPos = pathWaypoints[0];
  startMarker.position.set(startPos.x, 0.2, startPos.z);
  scene.add(startMarker);

  const endMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.26, 24),
    new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0x402300 })
  );
  const endPos = pathWaypoints[pathWaypoints.length - 1];
  endMarker.position.set(endPos.x, 0.2, endPos.z);
  scene.add(endMarker);

  const ghostTower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.65, 1.1, 22),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.38 })
  );
  ghostTower.position.y = 0.58;
  ghostTower.visible = false;
  scene.add(ghostTower);

  const towers = [];
  const enemies = [];
  const bullets = [];
  const occupied = new Set();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function worldToCell(point) {
    const col = Math.floor((point.x + (GRID_COLS * TILE) / 2) / TILE);
    const row = Math.floor((point.z + (GRID_ROWS * TILE) / 2) / TILE);
    return { col, row };
  }

  function isInsideGrid(col, row) {
    return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
  }

  function setHint(text) {
    hintLabel.textContent = text;
  }

  function updateHUD() {
    livesLabel.textContent = String(state.lives);
    moneyLabel.textContent = String(state.money);
    waveLabel.textContent = String(state.wave);
    remainingLabel.textContent = String(enemies.length + state.enemiesToSpawn);
    updateControls();
  }

  function updateControls() {
    const waveBusy = state.spawning || state.enemiesToSpawn > 0 || enemies.length > 0;
    const autoSeconds =
      state.autoNextWaveAt > 0 ? Math.max(0, Math.ceil((state.autoNextWaveAt - performance.now()) / 1000)) : 0;

    buildBasicBtn.classList.toggle("btn-build-active", state.buildMode === "basic");
    buildRapidBtn.classList.toggle("btn-build-active", state.buildMode === "rapid");

    buildBasicBtn.disabled = state.gameOver || state.money < towerTypes.basic.cost;
    buildRapidBtn.disabled = state.gameOver || state.money < towerTypes.rapid.cost;
    startWaveBtn.disabled = state.gameOver;
    cancelBuildBtn.disabled = state.gameOver || !state.buildMode;

    if (waveBusy) {
      startWaveBtn.textContent = "Oleada en curso (estado)";
    } else if (state.autoNextWaveAt > 0) {
      startWaveBtn.textContent = `Auto en ${autoSeconds}s (iniciar ya)`;
    } else {
      startWaveBtn.textContent = `Iniciar oleada ${state.wave + 1}`;
    }

    if (!state.buildMode) {
      cancelBuildBtn.textContent = "Sin modo de construcción";
      return;
    }

    cancelBuildBtn.textContent = `Salir de ${towerTypes[state.buildMode].label}`;
  }

  function setBuildMode(typeId) {
    if (!towerTypes[typeId]) return;
    state.buildMode = typeId;
    ghostTower.visible = true;
    ghostTower.material.color.setHex(towerTypes[typeId].color);
    setHint(`${towerTypes[typeId].label} seleccionada. Clic para construir.`);
    updateControls();
  }

  function cancelBuildMode() {
    state.buildMode = null;
    ghostTower.visible = false;
    setHint("Elige una torre y haz clic en una casilla libre. No puedes construir sobre el camino.");
    updateControls();
  }

  function createTower(typeId, col, row) {
    const type = towerTypes[typeId];
    const key = `${col},${row}`;
    if (state.money < type.cost) {
      setHint("Dinero insuficiente para esa torre.");
      return;
    }
    if (!isInsideGrid(col, row) || pathSet.has(key) || occupied.has(key)) {
      setHint("No puedes construir en esa casilla.");
      return;
    }

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.72, 0.55, 18),
      new THREE.MeshStandardMaterial({ color: 0x313c52, roughness: 0.42 })
    );
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.9),
      new THREE.MeshStandardMaterial({ color: type.color, emissive: 0x120a0a })
    );

    const group = new THREE.Group();
    group.add(base);
    group.add(head);

    const wp = cellToWorld(col, row);
    group.position.set(wp.x, 0.28, wp.z);
    head.position.set(0, 0.46, 0.12);
    scene.add(group);

    towers.push({
      type,
      mesh: group,
      head,
      cell: { col, row },
      cooldown: Math.random() * 0.18,
      target: null,
    });

    occupied.add(key);
    state.money -= type.cost;
    updateHUD();
    setHint(`${type.label} construida.`);
  }

  function spawnEnemy() {
    const waveScale = 1 + state.wave * 0.112;
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5 + Math.min(0.4, state.wave * 0.04), 0),
      new THREE.MeshStandardMaterial({ color: 0xffb3c4, emissive: 0x2a0d15, roughness: 0.35 })
    );
    const spawnPos = pathWaypoints[0];
    mesh.position.set(spawnPos.x, 0.5, spawnPos.z);
    scene.add(mesh);

    enemies.push({
      mesh,
      hp: 34 * waveScale,
      maxHp: 34 * waveScale,
      speed: 1.08 + state.wave * 0.056,
      waypointIndex: 1,
      reward: 7 + Math.floor(state.wave),
      damage: state.wave >= 11 ? 2 : 1,
    });
  }

  function startWave() {
    if (state.gameOver) return;
    if (state.spawning || state.enemiesToSpawn > 0 || enemies.length > 0) {
      setHint("La oleada actual sigue activa.");
      return;
    }

    state.autoNextWaveAt = 0;
    state.wave += 1;
    state.waveActive = true;
    state.enemiesToSpawn = 5 + state.wave * 2;
    state.spawnTimer = 0.15;
    state.spawning = true;
    overlay.hidden = true;
    setHint(`Oleada ${state.wave} iniciada.`);
    updateHUD();
  }

  function fireFromTower(tower, enemy) {
    const bullet = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({ color: tower.type.color, emissive: 0x1a0c0c })
    );

    const origin = tower.mesh.position.clone();
    origin.y = 0.86;
    bullet.position.copy(origin);
    scene.add(bullet);

    const direction = enemy.mesh.position.clone().sub(origin).normalize();
    bullets.push({
      mesh: bullet,
      direction,
      speed: tower.type.bulletSpeed,
      damage: tower.type.damage,
      maxDistance: tower.type.range + 1.8,
      traveled: 0,
    });
  }

  function nearestEnemy(origin, range) {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i];
      const dist = origin.distanceTo(e.mesh.position);
      if (dist < range && dist < bestDist) {
        best = e;
        bestDist = dist;
      }
    }

    return best;
  }

  function removeEnemy(index) {
    scene.remove(enemies[index].mesh);
    enemies.splice(index, 1);
  }

  function gameOver() {
    state.gameOver = true;
    state.spawning = false;
    state.enemiesToSpawn = 0;
    overlay.hidden = false;
    overlayTitle.textContent = "Defensa caída";
    overlayText.textContent = "El núcleo fue superado. Recarga la página para jugar de nuevo.";
    setHint("Partida finalizada.");
  }

  function updateWaveState() {
    if (
      state.waveActive &&
      !state.spawning &&
      state.enemiesToSpawn <= 0 &&
      enemies.length === 0 &&
      !state.gameOver &&
      state.wave > 0
    ) {
      state.money += 15 + state.wave * 2;
      state.waveActive = false;
      state.autoNextWaveAt = performance.now() + 3000;
      setHint(`Oleada ${state.wave} completada. Siguiente oleada automática en 3s.`);
      updateHUD();
    }
  }

  function handlePointerMove(event) {
    if (!state.buildMode || state.gameOver) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;

    const cell = worldToCell(hit);
    if (!isInsideGrid(cell.col, cell.row)) {
      ghostTower.visible = false;
      return;
    }

    const key = `${cell.col},${cell.row}`;
    const w = cellToWorld(cell.col, cell.row);
    ghostTower.visible = true;
    ghostTower.position.set(w.x, 0.58, w.z);

    if (pathSet.has(key) || occupied.has(key)) {
      ghostTower.material.color.setHex(0xff5a7a);
    } else {
      ghostTower.material.color.setHex(towerTypes[state.buildMode].color);
    }
  }

  function handlePointerDown(event) {
    if (!state.buildMode || state.gameOver) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;

    const cell = worldToCell(hit);
    createTower(state.buildMode, cell.col, cell.row);
  }

  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerdown", handlePointerDown);

  buildBasicBtn.addEventListener("click", () => setBuildMode("basic"));
  buildRapidBtn.addEventListener("click", () => setBuildMode("rapid"));
  startWaveBtn.addEventListener("click", startWave);
  cancelBuildBtn.addEventListener("click", cancelBuildMode);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "1") setBuildMode("basic");
    if (key === "2") setBuildMode("rapid");
    if (key === "escape") cancelBuildMode();
    if (event.code === "Space") startWave();
  });

  function resize() {
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  }

  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.033);

    stars.rotation.y += dt * 0.01;
    stars.rotation.x = Math.sin(performance.now() * 0.00008) * 0.04;

    if (!state.gameOver) {
      if (state.autoNextWaveAt > 0 && performance.now() >= state.autoNextWaveAt) {
        startWave();
      }

      if (state.spawning) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && state.enemiesToSpawn > 0) {
          spawnEnemy();
          state.enemiesToSpawn -= 1;
          state.spawnTimer = Math.max(0.36, 0.68 - state.wave * 0.02);
        }

        if (state.enemiesToSpawn <= 0) {
          state.spawning = false;
        }
      }

      for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const enemy = enemies[i];
        enemy.mesh.rotation.y += dt * 1.8;

        const wp = pathWaypoints[Math.min(enemy.waypointIndex, pathWaypoints.length - 1)];
        const direction = wp.clone().sub(enemy.mesh.position);
        direction.y = 0;
        const dist = direction.length();

        if (dist < 0.04) {
          enemy.waypointIndex += 1;
          if (enemy.waypointIndex >= pathWaypoints.length) {
            state.lives -= enemy.damage;
            removeEnemy(i);
            if (state.lives <= 0) {
              updateHUD();
              gameOver();
              break;
            }
            updateHUD();
            continue;
          }
        } else {
          direction.normalize();
          enemy.mesh.position.addScaledVector(direction, enemy.speed * dt);
        }
      }

      for (let i = towers.length - 1; i >= 0; i -= 1) {
        const tower = towers[i];
        tower.cooldown -= dt;

        const muzzle = tower.mesh.position.clone();
        muzzle.y = 0.86;
        const target = nearestEnemy(muzzle, tower.type.range);

        if (target) {
          const face = target.mesh.position.clone();
          face.y = 0.86;
          tower.head.lookAt(face);

          if (tower.cooldown <= 0) {
            fireFromTower(tower, target);
            tower.cooldown = tower.type.fireCooldown;
          }
        }
      }

      for (let i = bullets.length - 1; i >= 0; i -= 1) {
        const bullet = bullets[i];
        const travel = bullet.speed * dt;
        bullet.mesh.position.addScaledVector(bullet.direction, travel);
        bullet.traveled += travel;

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j -= 1) {
          const enemy = enemies[j];
          if (bullet.mesh.position.distanceTo(enemy.mesh.position) < 0.52) {
            enemy.hp -= bullet.damage;
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);
            hit = true;

            if (enemy.hp <= 0) {
              state.money += enemy.reward;
              removeEnemy(j);
              updateHUD();
            }
            break;
          }
        }

        if (!hit && bullet.traveled > bullet.maxDistance) {
          scene.remove(bullet.mesh);
          bullets.splice(i, 1);
        }
      }

      updateWaveState();
      updateHUD();
    }

    renderer.render(scene, camera);
  }

  overlay.hidden = true;
  updateHUD();
  tick();
})();
