(function () {
  const stage = document.getElementById("gameStage");
  const overlay = document.getElementById("gameOverlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const scoreLabel = document.getElementById("scoreLabel");
  const energyLabel = document.getElementById("energyLabel");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060d);

  const camera = new THREE.PerspectiveCamera(62, stage.clientWidth / stage.clientHeight, 0.1, 200);
  camera.position.set(0, 24, 20);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  stage.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x101020, 0.85));
  const dLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dLight.position.set(10, 18, 8);
  scene.add(dLight);

  const plane = new THREE.Mesh(
    new THREE.CircleGeometry(17, 80),
    new THREE.MeshStandardMaterial({ color: 0x171522, roughness: 0.95 })
  );
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xff6d8a, emissive: 0x430a1a, metalness: 0.18 })
  );
  core.position.y = 1.95;
  scene.add(core);

  const turretPivot = new THREE.Group();
  scene.add(turretPivot);

  const turretBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.95, 0.9, 20),
    new THREE.MeshStandardMaterial({ color: 0x65e7ff })
  );
  turretBase.position.y = 0.45;
  turretPivot.add(turretBase);

  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 2.8),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  barrel.position.set(0, 0.7, -1.45);
  turretPivot.add(barrel);

  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        Array.from({ length: 900 }, () => (Math.random() - 0.5) * 220),
        3
      )
    ),
    new THREE.PointsMaterial({ size: 0.45, color: 0xffffff })
  );
  scene.add(stars);

  const meteorGeo = new THREE.IcosahedronGeometry(0.85, 0);
  const meteorMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x351102 });
  const bulletGeo = new THREE.SphereGeometry(0.2, 10, 10);
  const bulletMat = new THREE.MeshStandardMaterial({ color: 0x8af2ff, emissive: 0x15484d });

  const meteors = [];
  const bullets = [];
  const keys = { left: false, right: false };

  const state = {
    running: false,
    ended: false,
    score: 0,
    energy: 100,
    spawnClock: 0,
    fireCooldown: 0,
    angle: 0,
  };

  function updateHUD() {
    scoreLabel.textContent = String(state.score);
    energyLabel.textContent = String(Math.max(0, Math.round(state.energy)));
  }

  function clearEntities() {
    while (meteors.length) {
      const m = meteors.pop();
      scene.remove(m.mesh);
    }
    while (bullets.length) {
      const b = bullets.pop();
      scene.remove(b.mesh);
    }
  }

  function spawnMeteor() {
    const angle = Math.random() * Math.PI * 2;
    const radius = 18 + Math.random() * 4;
    const mesh = new THREE.Mesh(meteorGeo, meteorMat);
    mesh.position.set(Math.cos(angle) * radius, 0.9, Math.sin(angle) * radius);
    mesh.userData.speed = 0.06 + Math.random() * 0.05;
    scene.add(mesh);

    const direction = new THREE.Vector3(-mesh.position.x, 0, -mesh.position.z).normalize();
    meteors.push({ mesh, direction });
  }

  function fireBullet() {
    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    const dir = new THREE.Vector3(Math.sin(state.angle), 0, -Math.cos(state.angle)).normalize();
    mesh.position.set(dir.x * 1.7, 0.8, dir.z * 1.7);
    scene.add(mesh);
    bullets.push({ mesh, direction: dir });
  }

  function startGame() {
    clearEntities();
    state.running = true;
    state.ended = false;
    state.score = 0;
    state.energy = 100;
    state.spawnClock = 0;
    state.fireCooldown = 0;
    state.angle = 0;
    turretPivot.rotation.y = 0;
    overlay.hidden = true;
    updateHUD();
  }

  function endGame() {
    state.running = false;
    state.ended = true;
    overlay.hidden = false;
    overlayTitle.textContent = "Núcleo destruido";
    overlayText.textContent = `Puntos conseguidos: ${state.score}. Presiona R para reiniciar.`;
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "a" || key === "arrowleft") keys.left = true;
    if (key === "d" || key === "arrowright") keys.right = true;

    if (event.code === "Space") {
      if (!state.running && !state.ended) {
        startGame();
      } else if (state.running && state.fireCooldown <= 0) {
        fireBullet();
        state.fireCooldown = 0.22;
      }
    }

    if (key === "r") {
      overlayTitle.textContent = "Reinicio";
      overlayText.textContent = "Gira la torreta, dispara y protege el núcleo de los meteoros.";
      startGame();
    }
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "a" || key === "arrowleft") keys.left = false;
    if (key === "d" || key === "arrowright") keys.right = false;
  });

  function resize() {
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  }

  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.033);

    core.rotation.y += dt * 0.65;
    core.position.y = 1.95 + Math.sin(performance.now() * 0.002) * 0.08;

    if (state.running) {
      if (keys.left) state.angle += dt * 2.4;
      if (keys.right) state.angle -= dt * 2.4;
      turretPivot.rotation.y = state.angle;

      state.fireCooldown = Math.max(0, state.fireCooldown - dt);
      state.spawnClock += dt;
      const spawnRate = Math.max(0.35, 1.05 - state.score * 0.015);

      if (state.spawnClock >= spawnRate) {
        state.spawnClock = 0;
        spawnMeteor();
      }

      for (let i = bullets.length - 1; i >= 0; i -= 1) {
        const bullet = bullets[i];
        bullet.mesh.position.addScaledVector(bullet.direction, dt * 28);
        if (bullet.mesh.position.length() > 26) {
          scene.remove(bullet.mesh);
          bullets.splice(i, 1);
        }
      }

      for (let i = meteors.length - 1; i >= 0; i -= 1) {
        const meteor = meteors[i];
        meteor.mesh.rotation.x += dt * 1.9;
        meteor.mesh.rotation.y += dt * 1.5;
        meteor.mesh.position.addScaledVector(meteor.direction, dt * 18 * meteor.mesh.userData.speed * 8);

        if (meteor.mesh.position.length() < 2.2) {
          state.energy -= 16;
          scene.remove(meteor.mesh);
          meteors.splice(i, 1);
          updateHUD();
          if (state.energy <= 0) {
            endGame();
            break;
          }
          continue;
        }

        for (let j = bullets.length - 1; j >= 0; j -= 1) {
          const bullet = bullets[j];
          if (meteor.mesh.position.distanceTo(bullet.mesh.position) < 0.95) {
            scene.remove(meteor.mesh);
            scene.remove(bullet.mesh);
            meteors.splice(i, 1);
            bullets.splice(j, 1);
            state.score += 5;
            updateHUD();
            break;
          }
        }
      }
    }

    renderer.render(scene, camera);
  }

  updateHUD();
  loop();
})();
