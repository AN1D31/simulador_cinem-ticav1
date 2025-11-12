document.addEventListener("DOMContentLoaded", () => {
/* ===============================
   DOM refs
=============================== */
const modeloSelect     = document.getElementById("modelo");         // mru | mrua
const tipoCalculo      = document.getElementById("tipoCalculo");    // velocidad | distancia | tiempo

const distanciaInput   = document.getElementById("distancia");
const unidadDistancia  = document.getElementById("unidad-distancia");
const tiempoInput      = document.getElementById("tiempo");
const unidadTiempo     = document.getElementById("unidad-tiempo");

const grupoMRUA        = document.getElementById("grupo-mrua");
const v0Input          = document.getElementById("v0");
const aInput           = document.getElementById("a");
const unidadA          = document.getElementById("unidad-a");

const btnIniciar       = document.getElementById("iniciar");
const btnPausar        = document.getElementById("pausar");
const btnReiniciar     = document.getElementById("reiniciar");
const btnExportar      = document.getElementById("exportar");
const resultado        = document.getElementById("resultado");

const estadoEl         = document.getElementById("estado");
const bola             = document.querySelector(".vehiculo");

const ctxPos = document.getElementById("graficaMRU").getContext("2d");
const ctxVel = document.getElementById("graficaVelocidad").getContext("2d");

/* ===============================
   Gráficas (Chart.js)
=============================== */
let grafPos = new Chart(ctxPos, {
  type: "line",
  data: { labels: [], datasets: [{ label: "Distancia (m)", data: [], borderColor: "blue", borderWidth: 2, tension: 0, fill: false, pointRadius: 2 }] },
  options: { responsive: true, maintainAspectRatio: false,
    scales: { x: { title: { display: true, text: "Tiempo (s)"}}, y: { title: { display: true, text: "Distancia (m)"}}}}
});
let grafVel = new Chart(ctxVel, {
  type: "line",
  data: { labels: [], datasets: [{ label: "Velocidad (m/s)", data: [], borderColor: "red", borderWidth: 2, tension: 0, fill: false, pointRadius: 2 }] },
  options: { responsive: true, maintainAspectRatio: false,
    scales: { x: { title: { display: true, text: "Tiempo (s)"}}, y: { title: { display: true, text: "Velocidad (m/s)"}}}}
});

/* Ajuste de alto para que las gráficas se vean bien en mobile */
function sizeCharts(){
  // 180px en desktop, 160/140 en mobile aprox
  const h = Math.max(160, Math.min(220, Math.round(window.innerHeight * 0.28)));
  document.getElementById("graficaMRU").style.height = h + "px";
  document.getElementById("graficaVelocidad").style.height = h + "px";
  grafPos.resize(); grafVel.resize();
}
sizeCharts();
window.addEventListener("resize", sizeCharts);

/* ===============================
   Exportación CSV (estado)
=============================== */
let lastTable = { model: null, headers: ["t (s)", "x (m)", "v (m/s)"], t: [], x: [], v: [] };
btnExportar.disabled = true;

/* ===============================
   Utilidades de unidades
=============================== */
const aSI_dist   = (d,u) => u==="km" ? d*1000 : d;
const aSI_tiempo = (t,u) => u==="min" ? t*60 : (u==="h" ? t*3600 : t);
const aSI_a      = (ax,u) => u==="kms2" ? ax*1000 : ax;

/* ===============================
   Helpers gráficas y estado
=============================== */
function clearCharts(){
  grafPos.data.labels = []; grafPos.data.datasets[0].data = []; grafPos.update();
  grafVel.data.labels = []; grafVel.data.datasets[0].data = []; grafVel.update();
  btnExportar.disabled = true;
}
function graficaMRU(velocidad, tTotal){
  const N = 40, labels=[], xs=[], vs=[];
  for(let i=0;i<=N;i++){
    const t = (tTotal*i)/N;
    labels.push(t.toFixed(2));
    xs.push((velocidad*t).toFixed(3));
    vs.push(velocidad.toFixed(3));
  }
  grafPos.data.labels = labels; grafPos.data.datasets[0].data = xs; grafPos.update();
  grafVel.data.labels = labels; grafVel.data.datasets[0].data = vs; grafVel.update();
  lastTable = { model:"MRU", headers:lastTable.headers, t:labels.map(Number), x:xs.map(Number), v:vs.map(Number) };
  btnExportar.disabled = false;
}
function graficaMRUA(v0,a,tTotal){
  const N = 60, labels=[], xs=[], vs=[];
  for(let i=0;i<=N;i++){
    const t = (tTotal*i)/N;
    const x = v0*t + 0.5*a*t*t;
    const v = v0 + a*t;
    labels.push(t.toFixed(2)); xs.push(x.toFixed(3)); vs.push(v.toFixed(3));
  }
  grafPos.data.labels = labels; grafPos.data.datasets[0].data = xs; grafPos.update();
  grafVel.data.labels = labels; grafVel.data.datasets[0].data = vs; grafVel.update();
  lastTable = { model:"MRUA", headers:lastTable.headers, t:labels.map(Number), x:xs.map(Number), v:vs.map(Number) };
  btnExportar.disabled = false;
}

function updateEstado(t, x, v){
  estadoEl.textContent = `Estado: t = ${t.toFixed(2)} s   x = ${x.toFixed(2)} m   v = ${v.toFixed(2)} m/s`;
}

/* ===============================
   Animación + Pausa/Continuar
=============================== */
let anim = {
  mode:"none", tTotal:0, t0:null, elapsed:0, raf:null,
  // MRU
  v:0, endX:0,
  // MRUA
  v0:0, a:0, escala:1, xFin:0
};
const cancelAnim = () => { if (anim.raf){ cancelAnimationFrame(anim.raf); anim.raf=null; } };

// MRU (recibe v para estado)
function animarBolaMRU(v, tTotal){
  const cont = bola.parentElement, ancho = cont.clientWidth;
  const xFin = 0.90*ancho - bola.clientWidth; // límite visual
  cancelAnim();
  anim = { mode:"mru", tTotal, t0:null, elapsed:0, raf:null, v, endX:xFin, v0:0, a:0, escala:1, xFin:0 };

  bola.style.transition="none"; bola.style.transform="translate(0px, -50%)";
  updateEstado(0, 0, v);

  const step = (ts)=>{
    if(!anim.t0) anim.t0 = ts - anim.elapsed;
    const t = Math.min((ts-anim.t0)/1000, anim.tTotal);
    const xp = Math.min(anim.endX*(t/anim.tTotal), anim.endX);
    const x = v * t;
    updateEstado(t, x, v);
    bola.style.transform = `translate(${xp}px, -50%)`;
    if(t<anim.tTotal) anim.raf = requestAnimationFrame(step);
  };
  anim.raf = requestAnimationFrame(step);
  btnPausar.disabled = false;
  btnReiniciar.disabled = false;
  btnPausar.textContent = "Pausar";
}

// MRUA
function animarBolaMRUA(v0,a,tTotal){
  const cont = bola.parentElement, ancho = cont.clientWidth;
  const xPixFin = 0.90*ancho - bola.clientWidth;

  cancelAnim();
  anim = { mode:"mrua", tTotal, t0:null, elapsed:0, raf:null, v:0, endX:0, v0, a, escala:1, xFin:xPixFin };

  const xMax = Math.max(1, v0*tTotal + 0.5*a*tTotal*tTotal); // m
  anim.escala = xPixFin / xMax;                                // m -> px

  bola.style.transition="none"; bola.style.transform="translate(0px, -50%)";
  updateEstado(0, 0, v0);

  const step = (ts)=>{
    if(!anim.t0) anim.t0 = ts - anim.elapsed;
    const t = Math.min((ts-anim.t0)/1000, anim.tTotal);
    const x = v0*t + 0.5*a*t*t;
    const v = v0 + a*t;
    const xp = Math.min(x*anim.escala, anim.xFin);
    updateEstado(t, x, v);
    bola.style.transform = `translate(${xp}px, -50%)`;
    if(t<anim.tTotal) anim.raf = requestAnimationFrame(step);
  };
  anim.raf = requestAnimationFrame(step);
  btnPausar.disabled = false;
  btnReiniciar.disabled = false;
  btnPausar.textContent = "Pausar";
}

// Pausar / Continuar
btnPausar.addEventListener("click", ()=>{
  if (anim.mode === "none") return;
  if (anim.raf){ // pausar
    cancelAnimationFrame(anim.raf); anim.raf = null;
    anim.elapsed = performance.now() - (anim.t0 ?? performance.now());
    btnPausar.textContent = "Continuar";
  } else {       // continuar
    const resume = (ts)=>{
      if(!anim.t0) anim.t0 = ts - anim.elapsed;
      const t = Math.min((ts-anim.t0)/1000, anim.tTotal);

      if (anim.mode === "mru"){
        const xp = Math.min(anim.endX*(t/anim.tTotal), anim.endX);
        const x = anim.v * t;
        updateEstado(t, x, anim.v);
        bola.style.transform = `translate(${xp}px, -50%)`;
      } else {
        const x = anim.v0*t + 0.5*anim.a*t*t;
        const v = anim.v0 + anim.a*t;
        const xp = Math.min(x*anim.escala, anim.xFin);
        updateEstado(t, x, v);
        bola.style.transform = `translate(${xp}px, -50%)`;
      }

      if (t<anim.tTotal) anim.raf = requestAnimationFrame(resume);
    };
    anim.raf = requestAnimationFrame(resume);
    btnPausar.textContent = "Pausar";
  }
});

/* ===============================
   Interacciones UI
=============================== */
modeloSelect.addEventListener("change", ()=>{
  const isMRUA = modeloSelect.value === "mrua";
  grupoMRUA.classList.toggle("oculto", !isMRUA);
  resultado.textContent = "";
  clearCharts();
  cancelAnim();
  bola.style.transition="none"; bola.style.transform="translate(0px, -50%)";
  updateEstado(0,0,0);
  anim.mode = "none";
  btnPausar.disabled = true; btnReiniciar.disabled = true;
});

// INICIAR
btnIniciar.addEventListener("click", ()=>{
  const modelo = modeloSelect.value;
  const tipo   = tipoCalculo.value;

  let distancia = distanciaInput.value ? parseFloat(distanciaInput.value) : NaN;
  let tiempo    = tiempoInput.value ? parseFloat(tiempoInput.value) : NaN;

  if (modelo === "mru"){
    if ((isNaN(distancia) && tipo !== "distancia") || (isNaN(tiempo) && tipo !== "tiempo")){
      resultado.textContent = "⚠️ Por favor ingresa los valores requeridos."; return;
    }
    distancia = aSI_dist(distancia, unidadDistancia.value);
    tiempo    = aSI_tiempo(tiempo, unidadTiempo.value);

    let v;
    if (tipo === "velocidad"){
      v = distancia / tiempo;
      resultado.textContent = `v = d/t → ${v.toFixed(2)} m/s (${(v*3.6).toFixed(2)} km/h)`;
      graficaMRU(v, tiempo);
      animarBolaMRU(v, tiempo);
    } else if (tipo === "distancia"){
      v = parseFloat(prompt("Ingresa la velocidad (m/s):"));
      if (isNaN(v)) return alert("Valor inválido.");
      const x = v * tiempo;
      resultado.textContent = `x = v·t → ${x.toFixed(2)} m`;
      graficaMRU(v, tiempo);
      animarBolaMRU(v, tiempo);
    } else { // tiempo
      v = parseFloat(prompt("Ingresa la velocidad (m/s):"));
      if (isNaN(v) || v === 0) return alert("Valor inválido o v=0.");
      const t = distancia / v;
      resultado.textContent = `t = d/v → ${t.toFixed(2)} s`;
      graficaMRU(v, t);
      animarBolaMRU(v, t);
    }
    return;
  }

  // MRUA
  let v0 = v0Input.value ? parseFloat(v0Input.value) : NaN;
  let a  = aInput.value  ? parseFloat(aInput.value)  : NaN;
  if (tipo !== "velocidad" && isNaN(distancia)){ resultado.textContent = "⚠️ Ingresa distancia o cambia el tipo de cálculo."; return; }
  if (tipo !== "tiempo" && isNaN(tiempo)){ resultado.textContent = "⚠️ Ingresa tiempo o cambia el tipo de cálculo."; return; }
  if (isNaN(v0)){ resultado.textContent = "⚠️ Ingresa la velocidad inicial (v₀)."; return; }
  if (isNaN(a)){  resultado.textContent = "⚠️ Ingresa la aceleración (a)."; return; }

  distancia = aSI_dist(distancia, unidadDistancia.value);
  tiempo    = aSI_tiempo(tiempo, unidadTiempo.value);
  a         = aSI_a(a, unidadA.value);

  if (tipo === "velocidad"){
    const v = v0 + a * tiempo;
    resultado.textContent = `v = v₀ + a·t → ${v.toFixed(2)} m/s`;
    graficaMRUA(v0, a, tiempo);
    animarBolaMRUA(v0, a, tiempo);
  } else if (tipo === "distancia"){
    const x = v0 * tiempo + 0.5 * a * tiempo * tiempo;
    resultado.textContent = `x = v₀·t + ½·a·t² → ${x.toFixed(2)} m`;
    graficaMRUA(v0, a, tiempo);
    animarBolaMRUA(v0, a, tiempo);
  } else { // tiempo
    const x = distancia;
    if (a === 0){
      if (v0 === 0){ resultado.textContent = "⚠️ Con a=0 y v₀=0 el tiempo es indeterminado."; return; }
      const t = x / v0;
      resultado.textContent = `t = x/v₀ → ${t.toFixed(2)} s (a=0)`;
      graficaMRUA(v0, 0, t);
      animarBolaMRUA(v0, 0, t);
      return;
    }
    const A = 0.5*a, B = v0, C = -x;
    const disc = B*B - 4*A*C;
    if (disc < 0){ resultado.textContent = "⚠️ No hay solución real para esos valores."; return; }
    const sqrt = Math.sqrt(disc);
    const t1 = (-B + sqrt)/(2*A), t2 = (-B - sqrt)/(2*A);
    const t  = Math.max(t1, t2);
    if (!isFinite(t) || t < 0){ resultado.textContent = "⚠️ La solución física (t>0) no existe para esos datos."; return; }
    resultado.textContent = `t = ${t.toFixed(2)} s (resolviendo ½·a·t² + v₀·t − x = 0)`;
    graficaMRUA(v0, a, t);
    animarBolaMRUA(v0, a, t);
  }
});

// Reiniciar
btnReiniciar.addEventListener("click", () => {
  distanciaInput.value = "";
  tiempoInput.value = "";
  unidadDistancia.value = "m";
  unidadTiempo.value = "s";
  v0Input.value = "";
  aInput.value = "";
  unidadA.value = "ms2";
  tipoCalculo.value = "velocidad";
  resultado.textContent = "";

  cancelAnim();
  bola.style.transition = "none";
  bola.style.transform = "translate(0px, -50%)";
  anim.mode = "none";
  clearCharts();
  updateEstado(0,0,0);

  btnPausar.textContent = "Pausar";
  btnPausar.disabled = true;
  btnReiniciar.disabled = true;
});

/* ===============================
   Exportar CSV
=============================== */
const csvRow = (vals) =>
  vals.map(v=>{
    const s=String(v);
    return (s.includes(",")||s.includes('"')||s.includes("\n")) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(",");
function buildCSV(){
  if (!lastTable.t.length) return null;
  const lines=[];
  lines.push(`Modelo,${lastTable.model}`);
  lines.push(csvRow(lastTable.headers));
  for(let i=0;i<lastTable.t.length;i++){
    lines.push(csvRow([lastTable.t[i].toFixed(3), lastTable.x[i].toFixed(3), lastTable.v[i].toFixed(3)]));
  }
  return lines.join("\n");
}
function downloadCSV(){
  const csv = buildCSV();
  if (!csv){ alert("Primero realiza un cálculo para generar datos."); return; }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  a.href = url; a.download = `simulacion_${lastTable.model}_${fecha}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
btnExportar.addEventListener("click", downloadCSV);

}); // DOMContentLoaded
