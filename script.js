// Toggle the upload form
function toggleForm(){

let form = document.getElementById("healthForm");

if(form.style.display === "flex"){
form.style.display = "none";
}else{
form.style.display = "flex";
}

}


// Save health data
function saveHealthData(event){

event.preventDefault();

let data = {

name: document.getElementById("name").value,
heartRate: document.getElementById("heartRate").value,
bloodSys: document.getElementById("bloodSys").value,
bloodDia: document.getElementById("bloodDia").value,
oxygen: document.getElementById("oxygen").value,
sleep: document.getElementById("sleep").value,
steps: document.getElementById("steps").value

};

localStorage.setItem("healthData", JSON.stringify(data));

window.location.href="dashboard.html";

}


// Load dashboard data
window.onload=function(){

let data = JSON.parse(localStorage.getItem("healthData"));

if(data){

document.getElementById("dName").innerText = data.name;

document.getElementById("dHeart").innerText =
data.heartRate + " BPM";

document.getElementById("dBP").innerText =
data.bloodSys + "/" + data.bloodDia + " mmHg";

document.getElementById("dOxygen").innerText =
data.oxygen + " %";

document.getElementById("dSleep").innerText =
data.sleep + " Hours";

document.getElementById("dSteps").innerText =
data.steps;

}


// ====================
// HEALTH ALERT LOGIC
// ====================

if(data){

let alerts=[];

if(data.heartRate > 100){
alerts.push("⚠ High Heart Rate Detected");
}

if(data.bloodSys > 140 || data.bloodDia > 90){
alerts.push("⚠ High Blood Pressure");
}

if(data.oxygen < 95){
alerts.push("⚠ Low Oxygen Level");
}

if(data.sleep < 5){
alerts.push("⚠ Poor Sleep Duration");
}

if(data.steps < 3000){
alerts.push("⚠ Low Physical Activity");
}

let alertBox=document.getElementById("alertMessage");

if(alertBox){

if(alerts.length>0){

alertBox.innerHTML = alerts.join("<br>");

}else{

alertBox.innerHTML = "✅ No anomalies detected";

}

}

}


// ====================
// REAL-TIME HEART GRAPH
// ====================

const ctx = document.getElementById("heartRateChart");

if(ctx){

let heartData=[80,82,79,85,88,90,86];

const chart = new Chart(ctx,{
type:"line",
data:{
labels:["1","2","3","4","5","6","7"],
datasets:[{
label:"Heart Rate",
data:heartData,
borderColor:"red",
borderWidth:3,
fill:false
}]
},
options:{
responsive:true,
animation:false
}
});


setInterval(()=>{

let newValue=Math.floor(Math.random()*20)+75;

heartData.push(newValue);
heartData.shift();

chart.update();

},1000);

}

};