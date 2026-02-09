(function () {
  const stage = document.getElementById("gameStage");
  const overlay = document.getElementById("gameOverlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const scoreLabel = document.getElementById("scoreLabel");
  const speedLabel = document.getElementById("speedLabel");

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x080810, 25, 70);

  const camera = new THREE.PerspectiveCamera(60, stage.clientWidth / stage.clientHeight, 0.1, 120);
  camera.position.set(0, 7, 12);
  camera.lookAt(0, 0, -8);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  stage.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(3, 8, 4);
  scene.add(dirLight);

  const laneX = [-4, 0, 4];
  let currentLane = 1;
  const playerTarget = new THREE.Vector3(0, 0.8, 7);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 90),
    new THREE.MeshStandardMaterial({ color: 0x1f1f2d, metalness: 0.1, roughness: 0.7 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.z = -12;
  scene.add(road);

  const laneLines = [];
  for (let i = 0; i < 45; i += 1) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.04, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xdc143c })
    );
    line.position.set(0, 0.03, -i * 2 + 7);
    scene.add(line);
    laneLines.push(line);
  }

  const player = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x66f0ff, emissive: 0x0b1418, roughness: 0.35 })
  );
  player.position.copy(playerTarget);
  scene.add(player);

  const obstacleGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const obstacleMat = new THREE.MeshStandardMaterial({ color: 0xff405f, roughness: 0.4 });
  const obstacles = [];

  function randomLane() {
    return laneX[Math.floor(Math.random() * laneX.length)];
  }

  function setupObstacle(offset) {
    const mesh = new THREE.Mesh(obstacleGeo, obstacleMat);
    mesh.position.set(randomLane(), 0.85, -25 - Math.random() * 30 - offset);
    mesh.userData.spin = Math.random() * 0.03 + 0.01;
    scene.add(mesh);
    obstacles.push(mesh);
  }

  for (let i = 0; i < 12; i += 1) {
    setupObstacle(i * 6);
  }

  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        Array.from({ length: 700 }, () => (Math.random() - 0.5) * 140),
        3
      )
    ),
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.25 })
  );
  scene.add(stars);

  const state = {
    running: false,
    gameOver: false,
    score: 0,
    speed: 0.22,
  };

  function startGame() {
    state.running = true;
    state.gameOver = false;
    state.score = 0;
    state.speed = 0.22;
    currentLane = 1;
    playerTarget.x = laneX[currentLane];
    overlay.hidden = true;
    scoreLabel.textContent = "0";
    speedLabel.textContent = "1.0x";
    for (let i = 0; i < obstacles.length; i += 1) {
      obstacles[i].position.set(randomLane(), 0.85, -25 - i * 5 - Math.random() * 15);
    }
  }

  function endGame() {
    state.running = false;
    state.gameOver = true;
    overlay.hidden = false;
    overlayTitle.textContent = "Impacto detectado";
    overlayText.textContent = `Puntaje final: ${state.score}. Presiona R para intentar otra vez.`;
  }

  function moveLane(delta) {
    currentLane = Math.max(0, Math.min(2, currentLane + delta));
    playerTarget.x = laneX[currentLane];
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if ((key === "arrowleft" || key === "a") && state.running) {
      moveLane(-1);
    }

    if ((key === "arrowright" || key === "d") && state.running) {
      moveLane(1);
    }

    if (event.code === "Space" && !state.running && !state.gameOver) {
      startGame();
    }

    if (key === "r") {
      overlayTitle.textContent = "Reinicio";
      overlayText.textContent = "Muévete entre carriles y evita chocar con los cubos.";
      startGame();
    }
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

    player.position.x += (playerTarget.x - player.position.x) * Math.min(1, dt * 14);
    player.rotation.y += dt * 1.8;

    for (let i = 0; i < laneLines.length; i += 1) {
      laneLines[i].position.z += state.running ? state.speed * 35 * dt : 0;
      if (laneLines[i].position.z > 10) {
        laneLines[i].position.z = -80;
      }
    }

    if (state.running) {
      state.speed += dt * 0.006;
      const liveSpeed = state.speed / 0.22;
      speedLabel.textContent = `${liveSpeed.toFixed(1)}x`;

      for (let i = 0; i < obstacles.length; i += 1) {
        const obstacle = obstacles[i];
        obstacle.rotation.x += obstacle.userData.spin;
        obstacle.rotation.z += obstacle.userData.spin * 0.8;
        obstacle.position.z += state.speed * 22;

        const dz = Math.abs(obstacle.position.z - player.position.z);
        const dx = Math.abs(obstacle.position.x - player.position.x);
        if (dz < 1.2 && dx < 1.3) {
          endGame();
          break;
        }

        if (obstacle.position.z > 13) {
          obstacle.position.z = -45 - Math.random() * 35;
          obstacle.position.x = randomLane();
          state.score += 1;
          scoreLabel.textContent = String(state.score);
        }
      }
    }

    renderer.render(scene, camera);
  }

  tick();
})();
