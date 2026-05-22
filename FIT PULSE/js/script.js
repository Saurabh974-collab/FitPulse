// ================= PAGE LOAD =================
window.onload = () => {
  clearDashboardView();
  resetSliders();
  setTimestamp();
  updateHealthStatus();
  loadDashboard();
  showUser();
};

let dashboardData = [];

function showToast(message, type = "info"){
  let host = document.getElementById("toastHost");

  if(!host){
    host = document.createElement("div");
    host.id = "toastHost";
    document.body.appendChild(host);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  host.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  window.setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 2600);
}

function toNumberOrZero(value){
  if(value === "" || value === null || typeof value === "undefined") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeHealthRecord(row){
  return {
    ...row,
    heart_rate: toNumberOrZero(row.heart_rate),
    steps: toNumberOrZero(row.steps),
    sleep_hours: toNumberOrZero(row.sleep_hours),
    status: row.status || "Normal",
    issues: Array.isArray(row.issues) ? row.issues : []
  };
}


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
function getCurrentLocalTimestamp(){
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localNow.toISOString().slice(0,16);
}

function isFutureTimestamp(tsValue){
  const selected = new Date(tsValue);
  if(Number.isNaN(selected.getTime())) return true;
  return selected.getTime() > Date.now();
}

function setTimestamp(){
  const ts = document.getElementById("timestamp");

  if(ts){
    const currentTs = getCurrentLocalTimestamp();
    ts.value = currentTs;
    ts.max = currentTs;

    ts.addEventListener("change", () => {
      const latestTs = getCurrentLocalTimestamp();
      ts.max = latestTs;

      if(ts.value && isFutureTimestamp(ts.value)){
        showToast("Date and time cannot exceed current date and time!", "error");
        ts.value = latestTs;
      }
    });
  }
}


// ================= HEALTH STATUS =================
function updateHealthStatus(){
  const box = document.getElementById("healthStatus");
  if(!box) return;

  box.innerText = "Health Status will be analyzed after saving.";
  box.style.background = "#1e293b";
}

function clearDashboardView(){
  const metricIds = ["dHeart", "dSteps", "dSleep", "avgHeart", "avgSteps", "avgSleep"];

  metricIds.forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.innerText = "--";
    }
  });

  const alertBox = document.getElementById("alertBox");
  if(alertBox){
    alertBox.innerHTML = "";
  }

  const table = document.getElementById("dataTable");
  if(table){
    table.innerHTML = "";
  }

  if(window.hrChart && typeof window.hrChart.destroy === "function"){
    window.hrChart.destroy();
    window.hrChart = null;
  }

  if(window.stepsChart && typeof window.stepsChart.destroy === "function"){
    window.stepsChart.destroy();
    window.stepsChart = null;
  }

  if(window.sleepChart && typeof window.sleepChart.destroy === "function"){
    window.sleepChart.destroy();
    window.sleepChart = null;
  }

  dashboardData = [];
}


// ================= SAVE DATA =================
let isSavingHealthData = false;

async function saveHealthData(event, buttonEl){
  if(event){
    event.preventDefault();
  }

  if(isSavingHealthData){
    showToast("Save already in progress...", "warning");
    return;
  }

  const saveBtn = buttonEl || document.querySelector(".submit-btn, .save-button");
  isSavingHealthData = true;

  if(saveBtn){
    saveBtn.disabled = true;
    saveBtn.classList.add("is-saving");
  }

  const username = localStorage.getItem("username");

  const entry = {
    username,
    timestamp: document.getElementById("timestamp").value,
    heart_rate: +document.getElementById("heartRate").value,
    steps: +document.getElementById("steps").value,
    sleep_hours: +document.getElementById("sleep").value
  };

  try {
    const res = await fetch("http://127.0.0.1:5000/save", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(entry)
    });

    const data = await res.json();

    if(!res.ok){
      showToast(data.msg || "Failed to save entry", "error");
      return;
    }

    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("Save request failed:", error);
    showToast("Save failed. Check backend connection.", "error");
  } finally {
    isSavingHealthData = false;
    if(saveBtn){
      saveBtn.disabled = false;
      saveBtn.classList.remove("is-saving");
    }
  }
}

// ================= DASHBOARD =================
async function loadDashboard(){
  if(!document.getElementById("dHeart")) return;

  const username = localStorage.getItem("username");
  const alertBox = document.getElementById("alertBox");

  clearDashboardView();

  try {
    const res = await fetch(`http://127.0.0.1:5000/data/${username}`);

    if(!res.ok){
      throw new Error(`Dashboard data request failed: ${res.status}`);
    }

    const data = await res.json();
    const cleanData = data.map(normalizeHealthRecord);
    dashboardData = cleanData;

    if(cleanData.length === 0){
      if(alertBox){
        alertBox.innerHTML = `<div style="color:#f59e0b">No health records yet.</div>`;
      }

      drawChart([]);
      return;
    }

    const last = cleanData[cleanData.length - 1];

    document.getElementById("dHeart").innerText = last.heart_rate + " BPM";
    document.getElementById("dSteps").innerText = last.steps;
    document.getElementById("dSleep").innerText = last.sleep_hours + " Hours";

    let totalHR = 0, totalSteps = 0, totalSleep = 0;

    cleanData.forEach(d => {
      totalHR += d.heart_rate;
      totalSteps += d.steps;
      totalSleep += d.sleep_hours;
    });

    document.getElementById("avgHeart").innerText = (totalHR/cleanData.length).toFixed(1)+" BPM";
    document.getElementById("avgSteps").innerText = Math.round(totalSteps/cleanData.length);
    document.getElementById("avgSleep").innerText = (totalSleep/cleanData.length).toFixed(1)+" Hours";

    showAlerts(last);
    buildTable(cleanData);
    drawChart(cleanData);
  } catch (error) {
    console.error("loadDashboard failed:", error);
    if(alertBox){
      alertBox.innerHTML = `<div style="color:#ef4444">Unable to load dashboard data. Check backend and login.</div>`;
    }
    showToast("Unable to load dashboard data. Check backend and login.", "error");
  }
}

// ================= ALERT =================
function showAlerts(last){

const box =
document.getElementById(
"alertBox"
);

const rec =
document.getElementById(
"recommendationBox"
);

if(!box)return;

box.innerHTML="";
if(rec)rec.innerHTML="";

if(last.status==="Normal"){

box.innerHTML = `
<div class="health-status normal">

<div class="status-icon">
✓
</div>

<div class="status-content">

<div class="status-title">
Health Status
</div>

<div class="status-text">
All values are normal
</div>

</div>

<div class="status-tag">
NORMAL
</div>

</div>
`;

return;

}

const issues=
last.issues||[];

box.innerHTML = `
<div class="health-alert ${last.status.toLowerCase()}">

<div class="alert-header">

<div class="pulse-dot"></div>

<h3>${last.status} Health Alert</h3>

</div>

<div class="alert-list">

${
issues.map(
i=>`

<div class="issue-item">

<span>⚠</span>

${i}

</div>

`
).join("")
}

</div>

</div>
`;

let tips=[];

issues.forEach(issue=>{

if(
issue.includes(
"Heart"
)
)
tips.push(
"Maintain a stable heart rate and avoid excessive stress."
);

if(
issue.includes(
"Activity"
)
)
tips.push(
"Walk more and increase daily movement."
);

if(
issue.includes(
"Sleep"
)
)
tips.push(
"Sleep at least 7–8 hours."
);

});

if(rec){

rec.innerHTML=
`
<div class="recommendation-card">

<div class="recommendation-title">

💡 Recommendation

</div>

<div class="recommendation-text">

${tips.length
  ? tips.map(
      t=>`<p>• ${t}</p>`
    ).join("")
  : "Maintain stable heart rate and avoid excessive stress."
}

</div>

</div>
`;

}

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
          <input type="checkbox" class="rowCheck" value="${row.id}">
        </td>
        <td>${row.timestamp}</td>
        <td>${row.heart_rate}</td>
        <td>${row.steps}</td>
        <td>${row.sleep_hours}</td>
        <td style="color:${row.status === 'Critical' ? 'red' : row.status === 'Warning' ? 'orange' : 'green'}">
          ${row.status}
        </td>
      </tr>
    `;
  });
}


// ================= CSV =================
function downloadCSV(){
  if(!dashboardData || !dashboardData.length){
    showToast("No data", "warning");
    return;
  }

  let csv = "timestamp,heart_rate,steps,sleep_hours\n";

  dashboardData.forEach(d=>{
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

function enableSelection(){
  document.querySelectorAll(".select-col").forEach(el=>{
    el.style.display = "table-cell";
  });

  document.getElementById("deleteSelectedBtn").style.display = "inline-block";
}

function openDeleteModal(){
  const checkboxes = document.querySelectorAll(".rowCheck:checked");

  if(checkboxes.length === 0){
    showToast("Select at least one record", "warning");
    return;
  }

  document.getElementById("modalText").innerText =
    "Are you sure you want to delete selected records?";

  document.getElementById("customModal").style.display = "flex";
}

function closeModal(){
  document.getElementById("customModal").style.display = "none";
}

async function confirmDelete(){
  const username = localStorage.getItem("username");

  const checkboxes = document.querySelectorAll(".rowCheck:checked");

  const ids = [];

  checkboxes.forEach(cb => {
    if(cb.value && cb.value.length > 5){
      ids.push(cb.value);
    }
  });

  if(ids.length === 0){
    showToast("Invalid selection", "error");
    return;
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/delete-selected", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, ids })
    });

    const data = await res.json();

    showToast(data.msg, "success");

    closeModal();
    location.reload();
  } catch (error) {
    console.error("Delete request failed:", error);
    showToast("Delete failed. Check the backend is running and try again.", "error");
  }
}

// ---------------- CLEAR ALL ----------------
async function clearAllData(){
  const username = localStorage.getItem("username");

  const res = await fetch(`http://127.0.0.1:5000/clear/${username}`, {
    method: "DELETE"
  });

  const data = await res.json();
  showToast(data.msg, "success");

  location.reload();
}


// ================= USER =================
async function saveUser(e){
  e.preventDefault();

  const username = document.getElementById("regUser").value;
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPass").value;

  const res = await fetch("http://127.0.0.1:5000/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      email,
      password
    })
  });

  const data = await res.json();

  showToast(data.msg, "success");

  if(res.ok){
    window.location.href = "index.html";
  }
}

async function loginUser(e){
  e.preventDefault();

  const errorBox = document.getElementById("loginError");
  const submitBtn = document.querySelector("form button[type='submit']");

  if(errorBox){
    errorBox.style.display = "none";
    errorBox.innerText = "";
  }

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPass").value;

  if(submitBtn){
    submitBtn.disabled = true;
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = { msg: "Unexpected server response" };
    }

    if(res.ok){
      showToast("Login successful", "success");
      localStorage.setItem("username", data.username || "");
      localStorage.setItem("email", email || "");
      localStorage.setItem("user", JSON.stringify({
        username: data.username || "",
        email: email || ""
      }));
      window.location.href = "dashboard.html";
      return;
    }

    const errMsg = data.msg || "Login failed";
    showToast(errMsg, "error");
    if(errorBox){
      errorBox.innerText = errMsg;
      errorBox.style.display = "block";
    }
  } catch (error) {
    const errMsg = "Unable to connect to server. Check backend is running.";
    showToast(errMsg, "error");
    if(errorBox){
      errorBox.innerText = errMsg;
      errorBox.style.display = "block";
    }
    console.error("Login request failed:", error);
  } finally {
    if(submitBtn){
      submitBtn.disabled = false;
    }
  }
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
  localStorage.removeItem("email");
  localStorage.removeItem("user");
  window.location.href="index.html";
}

// ================= EMAIL ALERT PREF =================
async function saveEmailAlert(){

  const mailToggle =
    document.getElementById("mail") ||
    document.getElementById("emailAlert");

  const enabled = !!(mailToggle && mailToggle.checked);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const username =
    user.username ||
    localStorage.getItem("username");

  if(!username){
    alert("No user found. Please login.");
    return;
  }

  const response = await fetch("http://127.0.0.1:5000/toggle-email-alert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      enabled
    })
  });

  const result = await response.json();

  console.log(result);

  alert(result.msg);

}

window.saveEmailAlert = saveEmailAlert;

// ================= CHART =================
function drawChart(data){

  if(window.hrChart && typeof window.hrChart.destroy === "function"){
    window.hrChart.destroy();
    window.hrChart = null;
  }

  if(window.stepsChart && typeof window.stepsChart.destroy === "function"){
    window.stepsChart.destroy();
    window.stepsChart = null;
  }

  if(window.sleepChart && typeof window.sleepChart.destroy === "function"){
    window.sleepChart.destroy();
    window.sleepChart = null;
  }

  if(!data || data.length === 0) return;

  const labels = data.map(d => d.timestamp);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: "#94A3B8"
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: "#64748B"
        },
        grid: {
          display: false
        }
      },
      y: {
        ticks: {
          color: "#64748B"
        },
        grid: {
          color: "rgba(255,255,255,.04)"
        }
      }
    }
  };

  // ❤️ HEART RATE
  const hrCtx = document.getElementById("heartChart");
  if(hrCtx){
    window.hrChart = new Chart(hrCtx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Heart Rate",
          data: data.map(d => d.heart_rate),
          fill: true,
          tension: .45,
          borderWidth: 4,
          pointRadius: 0,
          backgroundColor: "rgba(34,197,94,.15)",
          borderColor: "#4ADE80",
          fill: true,
        }]
      },
      options: chartOptions
    });
  }

  // 👣 STEPS
  const stepsCtx = document.getElementById("stepChart");
  if(stepsCtx){
    window.stepsChart = new Chart(stepsCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Steps",
          data: data.map(d => d.steps),
          backgroundColor: "#3b82f6"
        }]
      },
      options: chartOptions
    });
  }

  // 😴 SLEEP
  const sleepCtx = document.getElementById("sleepChart");
  if(sleepCtx){
    window.sleepChart = new Chart(sleepCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Sleep",
          data: data.map(d => d.sleep_hours),
          backgroundColor: "#22c55e"
        }]
      },
      options: chartOptions
    });
  }
}

// 🔥 MAKE FUNCTIONS GLOBAL
window.openDeleteModal = openDeleteModal;
window.closeModal = closeModal;
window.confirmDelete = confirmDelete;