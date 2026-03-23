// ================= PAGE LOAD =================
window.onload = () => {

  resetSliders();
  setTimestamp();
  updateHealthStatus();
  loadDashboard();
  showUser();

};


// ================= RESET =================
function resetSliders(){

  const heart = document.getElementById("heartRate");
  const steps = document.getElementById("steps");
  const sleep = document.getElementById("sleep");

  if(heart){
    heart.value = 0;
    document.getElementById("hrValue").innerText = 0;
  }

  if(steps){
    steps.value = 0;
    document.getElementById("stepsValue").innerText = 0;
  }

  if(sleep){
    sleep.value = 0;
    document.getElementById("sleepValue").innerText = 0;
  }

}


// ================= TIMESTAMP =================
function setTimestamp(){

  const ts = document.getElementById("timestamp");

  if(ts){
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    ts.value = now.toISOString().slice(0,16);
  }

}


// ================= HEALTH STATUS =================
function updateHealthStatus(){

  const heartEl = document.getElementById("heartRate");
  const stepsEl = document.getElementById("steps");
  const sleepEl = document.getElementById("sleep");
  const box = document.getElementById("healthStatus");

  if(!box || !heartEl || !stepsEl || !sleepEl) return;

  const heart = parseFloat(heartEl.value);
  const steps = parseFloat(stepsEl.value);
  const sleep = parseFloat(sleepEl.value);

  // 👉 NEW: if all are zero → show neutral state
  if(heart === 0 && steps === 0 && sleep === 0){
    box.innerText = "Health Status:";
    box.style.background = "#1e293b";
    return;
  }

  let alerts = [];

  if(heart > 100 || heart < 50)
    alerts.push("⚠ Abnormal Heart Rate");

  if(steps < 5000)
    alerts.push("⚠ Low Activity");

  if(sleep < 6)
    alerts.push("⚠ Poor Sleep");

  if(alerts.length === 0){
    box.innerText = "✓ Health Status: Normal";
    box.style.background = "#064e3b";
  } else {
    box.innerHTML = alerts.map(a => `<div>${a}</div>`).join("");
    box.style.background = "#7f1d1d";
  }
}

// ================= SAVE DATA =================
function saveHealthData(event){

  event.preventDefault();

  const ts = document.getElementById("timestamp").value;

  if(!ts){
    alert("Select date & time");
    return;
  }

  const entry = {
    timestamp: ts.replace("T"," ") + ":00",
    heart_rate: +document.getElementById("heartRate").value,
    steps: +document.getElementById("steps").value,
    sleep_hours: +document.getElementById("sleep").value
  };

  const data = JSON.parse(localStorage.getItem("healthData")) || [];

  data.push(entry);
  localStorage.setItem("healthData", JSON.stringify(data));

  alert("Saved Successfully!");

  window.location.href = "dashboard.html";
}


// ================= DASHBOARD =================
function loadDashboard(){

  if(!document.getElementById("dHeart")) return;

  const data = JSON.parse(localStorage.getItem("healthData")) || [];

  if(data.length === 0) return;

  const last = data[data.length - 1];

  // ===== CURRENT VALUES =====
  document.getElementById("dHeart").innerText = last.heart_rate + " BPM";
  document.getElementById("dSteps").innerText = last.steps;
  document.getElementById("dSleep").innerText = last.sleep_hours + " Hours";

  // ===== CARD COLORS =====
  
  // ===== AVERAGES =====
  let totalHR = 0;
  let totalSteps = 0;
  let totalSleep = 0;

  data.forEach(d => {
    totalHR += d.heart_rate;
    totalSteps += d.steps;
    totalSleep += d.sleep_hours;
  });

  document.getElementById("avgHeart").innerText =
    (totalHR / data.length).toFixed(1) + " BPM";

  document.getElementById("avgSteps").innerText =
    Math.round(totalSteps / data.length);

  document.getElementById("avgSleep").innerText =
    (totalSleep / data.length).toFixed(1) + " Hours";

  // ===== OTHER FEATURES =====
  showAlerts(last);
  buildTable(data);
 setTimeout(() => {
  drawChart(data);
}, 200);
}

// ================= ALERTS =================
function showAlerts(last){

  const box = document.getElementById("alertBox");
  if(!box) return;

  let alerts = [];

  if(last.heart_rate > 100) alerts.push("⚠ High heart rate");
  if(last.steps < 5000) alerts.push("⚠ Low activity");
  if(last.sleep_hours < 6) alerts.push("⚠ Poor sleep");

box.innerHTML = alerts.length
  ? alerts.map(a => `<div style="color:#ef4444">${a}</div>`).join("")
  : `<div style="color:#22c55e">✓ All values normal</div>`;

}


// ================= TABLE =================
function buildTable(data){

  const table = document.getElementById("dataTable");
  if(!table) return;

  table.innerHTML = "";

  data.forEach((row,i)=>{
    table.innerHTML += `
      <tr>
        <td class="select-col" style="display:none;">
  <input type="checkbox" class="rowCheck" value="${i}">
</td>
        <td>${row.timestamp}</td>
        <td>${row.heart_rate}</td>
        <td>${row.steps}</td>
        <td>${row.sleep_hours}</td>
      </tr>
    `;
  });

}


// ================= CHART =================
function drawChart(data){

  console.log("Chart Data:", data);

  if(typeof Chart === "undefined"){
    console.log("Chart.js not loaded");
    return;
  }

  if(!data || data.length === 0){
    console.log("No data");
    return;
  }

  const labels = data.map(d => d.timestamp);

  const heartCanvas = document.getElementById("heartRateChart");
  const stepsCanvas = document.getElementById("stepsChart");
  const sleepCanvas = document.getElementById("sleepChart");

  if(!heartCanvas || !stepsCanvas || !sleepCanvas){
    console.log("Canvas missing");
    return;
  }

  // ✅ SAFE DESTROY (FIXED)
  if(window.hrChart && typeof window.hrChart.destroy === "function"){
    window.hrChart.destroy();
  }

  if(window.stepsChart && typeof window.stepsChart.destroy === "function"){
    window.stepsChart.destroy();
  }

  if(window.sleepChart && typeof window.sleepChart.destroy === "function"){
    window.sleepChart.destroy();
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#fff" } }
    },
    scales: {
      x: { ticks: { color: "#fff" } },
      y: { ticks: { color: "#fff" } }
    }
  };

  // ❤️ HEART RATE
  window.hrChart = new Chart(heartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Heart Rate",
        data: data.map(d => d.heart_rate),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.2)",
        fill: true,
        tension: 0.4
      }]
    },
    options
  });
  backgroundColor: (ctx) => {
  const gradient = ctx.chart.ctx.createLinearGradient(0,0,0,300);
  gradient.addColorStop(0,"rgba(34,197,94,0.5)");
  gradient.addColorStop(1,"rgba(34,197,94,0)");
  return gradient;
}

  // 👣 STEPS
  window.stepsChart = new Chart(stepsCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Steps",
        data: data.map(d => d.steps),
        backgroundColor: "#3b82f6"
      }]
    },
    options
  });

  // 😴 SLEEP
  window.sleepChart = new Chart(sleepCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Sleep",
        data: data.map(d => d.sleep_hours),
        backgroundColor: "#22c55e"
      }]
    },
    options
  });

}
// ================= CSV =================
function downloadCSV(){

  const data = JSON.parse(localStorage.getItem("healthData")) || [];

  if(!data.length){
    alert("No data");
    return;
  }

  let csv = "timestamp,heart_rate,steps,sleep_hours\n";

  data.forEach(d=>{
    csv += `${d.timestamp},${d.heart_rate},${d.steps},${d.sleep_hours}\n`;
  });

  const blob = new Blob([csv], {type:"text/csv"});
  const a = document.createElement("a");

  a.href = URL.createObjectURL(blob);
  a.download = "fitpulse.csv";
  a.click();
}


// ================= CLEAR =================
function showClearOptions(){
  document.getElementById("clearOptions").style.display = "block";
}

let actionType = "";

function clearAllData(){
  actionType = "clearAll";
  showModal("Are you sure you want to clear ALL data?");
}

function enableSelection(){
  document.querySelectorAll(".select-col").forEach(el=>{
    el.style.display = "table-cell";
  });

  document.getElementById("deleteSelectedBtn").style.display = "inline-block";
}

function deleteSelected(){

  const checked = document.querySelectorAll(".rowCheck:checked");

  if(checked.length === 0){
    showModal("Select at least one row");
    return;
  }

  actionType = "deleteSelected";
  showModal("Delete selected data?");
}

// ================= USER =================
function saveUser(event){
  event.preventDefault();
  const user = document.getElementById("regUser").value;
  localStorage.setItem("username", user);
  alert("Registered!");
  window.location.href="index.html";
}

function showUser(){

  const user = localStorage.getItem("username");

  const name = document.getElementById("userName");
  const avatar = document.getElementById("avatar");

  if(user && name){
    name.innerText = user;
    avatar.innerText = user.charAt(0).toUpperCase();
  }

}

function toggleMenu(){
  document.getElementById("dropdownMenu").classList.toggle("show");
}

function logout(){
  localStorage.removeItem("username");
  window.location.href="index.html";
}

function loginUser(e){
  e.preventDefault();

  const email = document.querySelector("input[type='email']").value;

  // simple username from email
  const username = email.split("@")[0];

  localStorage.setItem("username", username);

  window.location.href = "home.html";
}

function showClearOptions(){
  document.getElementById("clearOptions").style.display = "block";
}

function clearAllData(){
  if(confirm("Clear all data?")){
    localStorage.removeItem("healthData");
    location.reload();
  }
}

function enableSelection(){

  // show select column
  document.querySelectorAll(".select-col").forEach(el=>{
    el.style.display = "table-cell";
  });

  // show delete button
  document.getElementById("deleteSelectedBtn").style.display = "inline-block";
}

function deleteSelected(){

  let data = JSON.parse(localStorage.getItem("healthData")) || [];

  const checked = document.querySelectorAll(".rowCheck:checked");

  if(checked.length === 0){
    alert("Select at least one row");
    return;
  }

  // get indexes
  const indexes = Array.from(checked).map(cb => parseInt(cb.value));

  // remove selected
  data = data.filter((_, i) => !indexes.includes(i));

  localStorage.setItem("healthData", JSON.stringify(data));

  alert("Selected data deleted!");
  location.reload();
}

function showModal(message){
  document.getElementById("modalText").innerText = message;
  document.getElementById("customModal").style.display = "flex";
}

function closeModal(){
  document.getElementById("customModal").style.display = "none";
}

function confirmAction(){

  let data = JSON.parse(localStorage.getItem("healthData")) || [];

  if(actionType === "clearAll"){
    localStorage.removeItem("healthData");
  }

  if(actionType === "deleteSelected"){
    const checked = document.querySelectorAll(".rowCheck:checked");
    const indexes = Array.from(checked).map(cb => parseInt(cb.value));
    data = data.filter((_, i) => !indexes.includes(i));
    localStorage.setItem("healthData", JSON.stringify(data));
  }

  closeModal();
  location.reload();
}