/* Декоративная анимация показывает сужение пула. Точки не являются данными датасета. */
const stages = [
  { count: "189 212", label: "объявлений", title: "Весь корпус объявлений", text: "Отправная точка: 189 212 объявлений услуг. Сравнивать тяжёлой моделью каждый запрос со всем корпусом слишком дорого.", methods: "Индекс объявлений", noteLabel: "Назначение", note: "Полный охват корпуса", fraction: "Весь корпус", dots: 125, spread: 1 },
  { count: "≈ 9 000", label: "кандидатов", title: "Широкий поиск", text: "Лексический поиск, география и семантические источники объединяют находки. Здесь важнее не пропустить подходящее объявление, чем точно расставить результаты.", methods: "BM25 · LSA · линейные векторы · BGE-M3", noteLabel: "Локальный Recall@pool", note: "0,996", fraction: "Около 4,8% корпуса", dots: 74, spread: .78 },
  { count: "1 500", label: "кандидатов", title: "Первый отбор: CatBoost L1", text: "Модель сочетает текстовые совпадения, оценки источников, категорию, географию, цену и качество объявления. Пул остаётся большим ради полноты.", methods: "CatBoost QuerySoftMax", noteLabel: "Локальный Recall@1500", note: "0,994", fraction: "До 1 500 объявлений", dots: 45, spread: .59 },
  { count: "750", label: "кандидатов", title: "Уточнение: CatBoost L2", text: "Второй отбор внимательнее проверяет заголовок, параметры, описание и фильтры запроса. На этом шаге остаются 750 объявлений для финальной модели.", methods: "CatBoost QuerySoftMax", noteLabel: "Локальный Recall@750", note: "0,986", fraction: "До 750 объявлений", dots: 27, spread: .43 },
  { count: "50", label: "объявлений", title: "Финальный выбор", text: "LambdaMART учитывает признаки пары и её положение среди кандидатов. Дообученный BGE cross-encoder глубже сопоставляет тексты; их ранги объединяются в итоговые 50.", methods: "LambdaMART-topk + BGE reranker", noteLabel: "Скрытый Recall@50", note: "0,850967", fraction: "Итоговые 50", dots: 12, spread: .26 }
];

const stepButtons = [...document.querySelectorAll(".step")];
const particleRoot = document.getElementById("particles");
const flowArea = document.getElementById("flowArea");
const playButton = document.getElementById("playButton");
const nextButton = document.getElementById("nextButton");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let activeStage = 0;
let timer = null;

/* Детерминированное распределение сохраняет узнаваемые точки между переходами. */
function pseudoRandom(seed) {
  const x = Math.sin(seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const particles = Array.from({ length: stages[0].dots }, (_, index) => {
  const node = document.createElement("i");
  node.className = "particle";
  node.style.setProperty("--delay", `${(index % 12) * 42}ms`);
  node.dataset.color = String(index % 4);
  particleRoot.append(node);
  return node;
});

function updateStage(index) {
  activeStage = index;
  const data = stages[index];
  flowArea.dataset.stage = String(index);
  document.getElementById("coreCount").textContent = data.count;
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

  particles.forEach((node, particleIndex) => {
    const x = pseudoRandom(particleIndex + 2) * 2 - 1;
    const y = pseudoRandom(particleIndex + 433) * 2 - 1;
    const orbit = pseudoRandom(particleIndex + 823);
    const visible = particleIndex < data.dots;
    node.style.left = `${50 + x * 43 * data.spread}%`;
    node.style.top = `${50 + y * 40 * data.spread}%`;
    node.style.opacity = visible ? String(.37 + orbit * .58) : "0";
    node.style.transform = `translate(-50%, -50%) scale(${visible ? .7 + orbit * .9 : .15})`;
  });
}

function stopAutoPlay() {
  if (timer) window.clearInterval(timer);
  timer = null;
  playButton.innerHTML = "▶ <span>Пуск</span>";
  playButton.setAttribute("aria-label", "Запустить анимацию");
  playButton.setAttribute("aria-pressed", "false");
}

function startAutoPlay() {
  if (reducedMotion.matches) return;
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(() => updateStage((activeStage + 1) % stages.length), 2900);
  playButton.innerHTML = "Ⅱ <span>Пауза</span>";
  playButton.setAttribute("aria-label", "Приостановить анимацию");
  playButton.setAttribute("aria-pressed", "true");
}

stepButtons.forEach(button => button.addEventListener("click", () => {
  stopAutoPlay();
  updateStage(Number(button.dataset.stage));
}));
nextButton.addEventListener("click", () => { stopAutoPlay(); updateStage((activeStage + 1) % stages.length); });
playButton.addEventListener("click", () => timer ? stopAutoPlay() : startAutoPlay());
reducedMotion.addEventListener("change", event => { if (event.matches) stopAutoPlay(); });

updateStage(0);
if (!reducedMotion.matches) startAutoPlay();
