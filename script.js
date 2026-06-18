const navToggle = document.querySelector('#navToggle');
const navLinks = document.querySelector('#navLinks');
const houseSize = document.querySelector('#houseSize');
const surfaceValue = document.querySelector('#surfaceValue');
const estimateValue = document.querySelector('#estimateValue');
const recommendation = document.querySelector('#recommendation');
const barChart = document.querySelector('#barChart');
const currentKw = document.querySelector('#currentKw');
const meterFill = document.querySelector('#meterFill');
const saving = document.querySelector('#saving');
const co2 = document.querySelector('#co2');
const alerts = document.querySelector('#alerts');

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

const bars = [42, 68, 35, 80, 55, 92, 48, 72, 61, 38, 84, 57];
barChart.innerHTML = bars.map((height) => `<span style="height:${height}%"></span>`).join('');

function updateEstimate() {
  const surface = Number(houseSize.value);
  const estimate = Math.round(surface * 5);
  surfaceValue.textContent = surface;
  estimateValue.textContent = estimate;

  if (surface < 50) {
    recommendation.textContent = 'Limiter les veilles et suivre les appareils actifs';
  } else if (surface < 100) {
    recommendation.textContent = 'Décaler le chauffage en heures creuses';
  } else {
    recommendation.textContent = 'Prioriser isolation, chauffage et suivi pièce par pièce';
  }
}

function animateDashboard() {
  const kw = (2.4 + Math.random() * 2.2).toFixed(1);
  const percent = Math.min(95, Math.round(Number(kw) * 18));
  currentKw.textContent = `${kw} kW`;
  meterFill.style.width = `${percent}%`;
  saving.textContent = `${14 + Math.round(Math.random() * 8)}%`;
  co2.textContent = `${35 + Math.round(Math.random() * 18)} kg`;
  alerts.textContent = `${1 + Math.round(Math.random() * 3)}`;
}

houseSize.addEventListener('input', updateEstimate);
updateEstimate();
animateDashboard();
setInterval(animateDashboard, 2500);
