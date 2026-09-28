/*
 * Символическая визуализация каскада: частицы и ширина потока показывают
 * последовательное сокращение числа кандидатов, а не реальные строки данных.
 * Canvas рисует один кадр при выключенной анимации и работает без библиотек.
 */
const stages = [
  { count: "189 212", label: "объявлений", title: "Весь корпус объявлений", text: "Отправная точка: 189 212 объявлений услуг. Сравнивать тяжёлой моделью каждый запрос со всем корпусом слишком дорого.", methods: "Индекс объявлений", noteLabel: "Назначение", note: "Полный охват корпуса", fraction: "Весь корпус" },
  { count: "≈ 9 000", label: "кандидатов", title: "Широкий поиск", text: "Лексический поиск, география и семантические источники объединяют находки. Здесь важнее не пропустить подходящее объявление, чем точно расставить результаты.", methods: "BM25 · LSA · линейные векторы · BGE-M3", noteLabel: "Локальный Recall@pool", note: "0,996", fraction: "Около 4,8% корпуса" },
  { count: "1 500", label: "кандидатов", title: "Первый отбор: CatBoost L1", text: "Модель сочетает текстовые совпадения, оценки источников, категорию, географию, цену и качество объявления. Пул остаётся большим ради полноты.", methods: "CatBoost QuerySoftMax", noteLabel: "Локальный Recall@1500", note: "0,994", fraction: "До 1 500 объявлений" },
  { count: "750", label: "кандидатов", title: "Уточнение: CatBoost L2", text: "Второй отбор внимательнее проверяет заголовок, параметры, описание и фильтры запроса. На этом шаге остаются 750 объявлений для финальной модели.", methods: "CatBoost QuerySoftMax", noteLabel: "Локальный Recall@750", note: "0,986", fraction: "До 750 объявлений" },
  { count: "50", label: "объявлений", title: "Финальный выбор", text: "LambdaMART учитывает признаки пары и её положение среди кандидатов. Дообученный BGE cross-encoder глубже сопоставляет тексты; их ранги объединяются в итоговые 50.", methods: "LambdaMART-topk + BGE reranker", noteLabel: "Скрытый Recall@50", note: "0,850967", fraction: "Итоговые 50" }
];

const stepButtons = [...document.querySelectorAll(".step")];
const explainCards = [...document.querySelectorAll(".explain-card")];
const diagramJumpButtons = [...document.querySelectorAll(".diagram-jump")];
const gateElements = [...document.querySelectorAll(".flow-gate")];
const pipelineCard = document.querySelector(".pipeline-card");
const flowArea = document.getElementById("flowArea");
const flowCanvas = document.getElementById("flowCanvas");
const context = flowCanvas.getContext("2d", { alpha: true });
const readout = document.querySelector(".flow-readout");
const detail = document.querySelector(".stage-detail");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let activeStage = 0;
let visualProgress = 0;
let fromProgress = 0;
let targetProgress = 0;
let displayedCount = 189212;
let fromCount = 189212;
let transitionStart = 0;
let animationClock = 0;
let lastFrame = 0;
let frameId = 0;
let autoTimer = 0;
let isPlaying = !reducedMotion.matches && !document.hidden;
let width = 0;
let height = 0;

const stageColors = ["#61baff", "#b38cff", "#6bd9ed", "#ffc979", "#80ee9c"];
const stageCounts = [189212, 9000, 1500, 750, 50];
const countFormatter = new Intl.NumberFormat("ru-RU");
const survival = [1, .72, .47, .29, .13];

function random(seed) {
  const x = Math.sin(seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function colorAt(progress) {
  const left = Math.min(3, Math.max(0, Math.floor(progress)));
  const fraction = Math.min(1, Math.max(0, progress - left));
  const first = stageColors[left].match(/[\da-f]{2}/gi).map(part => parseInt(part, 16));
  const second = stageColors[left + 1].match(/[\da-f]{2}/gi).map(part => parseInt(part, 16));
  return first.map((value, channel) => Math.round(lerp(value, second[channel], fraction)));
}

/* Пять сечений сужающегося потока совпадают с пятью этапами над схемой. */
function geometry(t) {
  const x = width * (.09 + .82 * t);
  const scaled = Math.min(3.9999, t * 4);
  const part = Math.floor(scaled);
  const blend = ease(scaled - part);
  const spreads = [.34, .24, .165, .11, .054];
  const spread = height * lerp(spreads[part], spreads[part + 1], blend);
  const center = height * (.55 + .025 * Math.sin(t * Math.PI * 1.7));
  return { x, spread, center };
}

function ribbon(limit, opacity, color) {
  if (limit <= .001) return;
  const steps = Math.max(3, Math.ceil(limit * 90));
  context.beginPath();
  for (let j = 0; j <= steps; j++) {
    const point = geometry(limit * j / steps);
    if (j === 0) context.moveTo(point.x, point.center - point.spread);
    else context.lineTo(point.x, point.center - point.spread);
  }
  for (let j = steps; j >= 0; j--) {
    const point = geometry(limit * j / steps);
    context.lineTo(point.x, point.center + point.spread);
  }
  context.closePath();
  context.globalAlpha = opacity;
  context.fillStyle = color;
  context.fill();
  context.globalAlpha = 1;
}

function drawScene(time, progress) {
  if (!width || !height) return;
  context.clearRect(0, 0, width, height);
  const reach = Math.max(.025, progress / 4);
  const gradient = context.createLinearGradient(width * .1, 0, width * .91, 0);
  stageColors.forEach((color, index) => gradient.addColorStop(index / 4, color));

  ribbon(1, .055, gradient);
  ribbon(reach, .095, gradient);

  /* Мягкая световая волна идёт вместе с выбранным этапом. */
  const head = geometry(reach);
  const [red, green, blue] = colorAt(progress);
  const halo = context.createRadialGradient(head.x, head.center, 4, head.x, head.center, Math.min(170, width * .16));
  halo.addColorStop(0, `rgba(${red}, ${green}, ${blue}, .27)`);
  halo.addColorStop(.5, `rgba(${red}, ${green}, ${blue}, .1)`);
  halo.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
  context.fillStyle = halo;
  context.fillRect(0, 0, width, height);

  /* Полупрозрачные траектории делают поток цельным даже между частицами. */
  for (let lane = -8; lane <= 8; lane++) {
    context.beginPath();
    for (let j = 0; j <= 80; j++) {
      const t = j / 80;
      const point = geometry(t);
      const drift = Math.sin(t * 9 + lane * .7 + time * .00045) * (1 - t) * 3;
      const y = point.center + point.spread * lane / 9 + drift;
      if (j === 0) context.moveTo(point.x, y);
      else context.lineTo(point.x, y);
    }
    context.strokeStyle = gradient;
    context.globalAlpha = lane % 3 === 0 ? .17 : .085;
    context.lineWidth = lane === 0 ? 1.5 : 1;
    context.stroke();
  }
  context.globalAlpha = 1;

  /* Часть точек гаснет у каждого «сита», оставшиеся продолжают движение. */
  const activeGate = geometry(activeStage / 4);
  for (let i = 0; i < 310; i++) {
    const phase = random(i + 17);
    const speed = .000022 + random(i + 217) * .000027;
    const t = (phase + time * speed) % 1;
    if (t > reach) continue;
    const gateIndex = Math.min(4, Math.floor(t * 4 + .015));
    if (random(i + 779) > survival[gateIndex]) continue;
    const point = geometry(t);
    const lane = random(i + 407) * 2 - 1;
    const drift = Math.sin(time * .0015 + i) * (1 - t) * 4;
    const y = point.center + lane * point.spread * .89 + drift;
    if (Math.abs(point.x - activeGate.x) < 12 && Math.abs(y - activeGate.center) < 28) continue;
    const size = 1.1 + random(i + 997) * 2.1;
    const edgeFade = Math.min(1, t * 45, (reach - t) * 35 + .18);
    const alpha = (.37 + random(i + 1307) * .55) * edgeFade;
    context.fillStyle = stageColors[gateIndex];
    context.globalAlpha = alpha;
    context.beginPath();
    context.arc(point.x, y, size, 0, Math.PI * 2);
    context.fill();
    if (i % 11 === 0) {
      context.globalAlpha = alpha * .16;
      context.beginPath();
      context.arc(point.x, y, size * 3.8, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 1;
}

function resizeCanvas() {
  const rect = flowCanvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  flowCanvas.width = Math.round(width * pixelRatio);
  flowCanvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawScene(animationClock, visualProgress);
}

function queueFrame() {
  if (!frameId) frameId = requestAnimationFrame(onFrame);
}

function onFrame(timestamp) {
  frameId = 0;
  if (lastFrame) animationClock += Math.min(timestamp - lastFrame, 50) * (isPlaying ? 1 : .35);
  lastFrame = timestamp;
  const elapsed = Math.min(1, (timestamp - transitionStart) / 2400);
  visualProgress = lerp(fromProgress, targetProgress, ease(elapsed));
  displayedCount = lerp(fromCount, stageCounts[activeStage], ease(elapsed));
  document.getElementById("coreCount").textContent =
    `${activeStage === 1 && elapsed === 1 ? "≈ " : ""}${countFormatter.format(Math.round(displayedCount))}`;
  drawScene(animationClock, visualProgress);
  if (isPlaying || elapsed < 1) queueFrame();
  else lastFrame = 0;
}

function updateStage(index) {
  activeStage = index;
  const data = stages[index];
  fromProgress = visualProgress;
  fromCount = displayedCount;
  targetProgress = index;
  transitionStart = performance.now();
  flowArea.dataset.stage = String(index);
  pipelineCard.style.setProperty("--active-color", stageColors[index]);
  document.getElementById("coreLabel").textContent = data.label;
  document.getElementById("detailNumber").textContent = `ЭТАП ${String(index + 1).padStart(2, "0")} / 05`;
  document.getElementById("detailTitle").textContent = data.title;
  document.getElementById("detailText").textContent = data.text;
  document.getElementById("detailMethods").textContent = data.methods;
  document.getElementById("detailRecallLabel").textContent = data.noteLabel;
  document.getElementById("detailRecall").textContent = data.note;
  document.getElementById("stageFraction").textContent = data.fraction;

  stepButtons.forEach((button, buttonIndex) => {
    button.classList.toggle("is-active", buttonIndex === index);
    button.classList.toggle("is-complete", buttonIndex < index);
    button.setAttribute("aria-pressed", buttonIndex === index ? "true" : "false");
  });
  gateElements.forEach((gate, gateIndex) => {
    gate.classList.toggle("is-active", gateIndex === index);
    gate.classList.toggle("is-complete", gateIndex < index);
  });
  explainCards.forEach((card, cardIndex) => {
    card.classList.toggle("is-current", cardIndex === index);
  });

  readout.classList.remove("is-changing");
  detail.classList.remove("is-changing");
  void readout.offsetWidth;
  readout.classList.add("is-changing");
  detail.classList.add("is-changing");
  if (reducedMotion.matches) {
    visualProgress = index;
    displayedCount = stageCounts[index];
    document.getElementById("coreCount").textContent = data.count;
    drawScene(animationClock, visualProgress);
  } else queueFrame();
}

function stopAutoPlay() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = 0;
}

function scheduleAutoPlay(delay = 5600) {
  stopAutoPlay();
  if (reducedMotion.matches || document.hidden || activeStage === stages.length - 1) return;
  autoTimer = setTimeout(() => {
    updateStage(activeStage + 1);
    scheduleAutoPlay();
  }, delay);
}

stepButtons.forEach(button => button.addEventListener("click", () => {
  updateStage(Number(button.dataset.stage));
  scheduleAutoPlay(9500);
}));
diagramJumpButtons.forEach(button => button.addEventListener("click", () => {
  updateStage(Number(button.dataset.jumpStage));
  scheduleAutoPlay(9500);
  document.getElementById("pipeline").scrollIntoView({
    behavior: reducedMotion.matches ? "auto" : "smooth",
    block: "start"
  });
}));
reducedMotion.addEventListener("change", event => {
  if (event.matches) {
    stopAutoPlay();
    isPlaying = false;
    visualProgress = activeStage;
    displayedCount = stageCounts[activeStage];
    document.getElementById("coreCount").textContent = stages[activeStage].count;
    drawScene(animationClock, visualProgress);
  } else {
    isPlaying = !document.hidden;
    scheduleAutoPlay();
    if (isPlaying) queueFrame();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAutoPlay();
    isPlaying = false;
  } else if (!reducedMotion.matches) {
    isPlaying = true;
    lastFrame = 0;
    transitionStart = performance.now() - 2400;
    fromProgress = visualProgress;
    fromCount = displayedCount;
    scheduleAutoPlay();
    queueFrame();
  }
});
new ResizeObserver(resizeCanvas).observe(flowCanvas);

updateStage(0);
if (!reducedMotion.matches) scheduleAutoPlay();
