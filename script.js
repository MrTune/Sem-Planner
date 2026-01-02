/**********************************************************
 * SEMESTER PLANNER — SINGLE SOURCE OF TRUTH
 **********************************************************/

const STORAGE_KEY = "semesterPlannerData";

/**********************************************************
 * DATA INITIALIZATION
 **********************************************************/
function initData() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    const courses = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      name: `Course ${i + 1}: Subject Name`,
      totalMarks: i % 2 === 0 ? 200 : 300,
      evaluatives: []
    }));
    saveData({ courses });
  }
}

function loadData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY));
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

initData();

/**********************************************************
 * UTILITIES
 **********************************************************/
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(date) {
  const d1 = new Date(date);
  const d2 = new Date(todayISO());
  return Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**********************************************************
 * HOME PAGE LOGIC (index.html)
 **********************************************************/
function renderHome() {
  const data = loadData();
  const container = document.getElementById("coursesContainer");
  if (!container) return;

  container.innerHTML = "";

  data.courses.forEach(course => {
    const obtained = course.evaluatives.reduce(
      (s, e) => s + (Number(e.obtained) || 0),
      0
    );

    const percent = ((obtained / course.totalMarks) * 100).toFixed(1);

    const card = document.createElement("div");
    card.className = "course-card";
    card.innerHTML = `
      <h3>${course.name}</h3>
      <div class="progress-bar">
        <div style="width:${percent}%"></div>
      </div>
      <div class="progress-text">${obtained} / ${course.totalMarks}</div>
    `;
    card.onclick = () => {
      window.location.href = `course.html?id=${course.id}`;
    };

    container.appendChild(card);
  });

  renderUpcoming();
}

/**********************************************************
 * UPCOMING EVALUATIVES
 **********************************************************/
function renderUpcoming() {
  const box = document.getElementById("upcomingList");
  if (!box) return;

  const data = loadData();
  const today = todayISO();
  const upcoming = [];

  data.courses.forEach(course => {
    course.evaluatives.forEach(ev => {
      if (ev.date && ev.date >= today) {
        upcoming.push({ ...ev, course: course.name });
      }
    });
  });

  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  box.innerHTML = "";

  if (upcoming.length === 0) {
    box.innerHTML = `<p class="muted">No upcoming evaluatives</p>`;
    return;
  }

  upcoming.forEach(ev => {
    const d = daysBetween(ev.date);
    const badge =
      d <= 3 ? "urgent" : d <= 7 ? "soon" : "later";

    const el = document.createElement("div");
    el.className = `upcoming-item ${badge}`;
    el.innerHTML = `
      <div class="calendar-box">
        <span>${new Date(ev.date).toLocaleString("en", { month: "short" })}</span>
        <strong>${new Date(ev.date).getDate()}</strong>
      </div>
      <div>
        <b>${ev.name}</b>
        <div class="muted">${ev.course}</div>
        <div class="muted">${d} days left</div>
      </div>
    `;
    box.appendChild(el);
  });
}

/**********************************************************
 * COURSE PAGE LOGIC (course.html)
 **********************************************************/
function renderCourse() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  if (!id) return;

  const data = loadData();
  const course = data.courses.find(c => c.id === id);
  if (!course) return;

  document.getElementById("courseName").value = course.name;
  document.getElementById("courseName").onchange = e => {
    course.name = e.target.value;
    saveData(data);
  };

  document.getElementById("totalMarks").innerText = course.totalMarks;

  const table = document.getElementById("evalTable");
  table.innerHTML = "";

  course.evaluatives.forEach((ev, idx) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input value="${ev.name}" /></td>
      <td><input type="date" value="${ev.date || ""}" /></td>
      <td><input type="number" value="${ev.max || ""}" /></td>
      <td><input type="number" value="${ev.obtained || ""}" /></td>
      <td><button class="delete-btn">×</button></td>
    `;

    const inputs = row.querySelectorAll("input");
    inputs[0].onchange = e => ev.name = e.target.value;
    inputs[1].onchange = e => ev.date = e.target.value;
    inputs[2].onchange = e => ev.max = Number(e.target.value);
    inputs[3].onchange = e => ev.obtained = Number(e.target.value);

    inputs.forEach(i =>
      i.addEventListener("change", () => {
        saveData(data);
        updateCourseStats(course);
      })
    );

    row.querySelector("button").onclick = () => {
      course.evaluatives.splice(idx, 1);
      saveData(data);
      renderCourse();
    };

    table.appendChild(row);
  });

  updateCourseStats(course);
}

function addEvaluative() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  const data = loadData();
  const course = data.courses.find(c => c.id === id);

  course.evaluatives.push({
    name: "New Evaluative",
    date: "",
    max: 0,
    obtained: 0
  });

  saveData(data);
  renderCourse();
}

function clearEvaluatives() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  const data = loadData();
  const course = data.courses.find(c => c.id === id);

  course.evaluatives = [];
  saveData(data);
  renderCourse();
}

function updateCourseStats(course) {
  const totalObtained = course.evaluatives.reduce(
    (s, e) => s + (Number(e.obtained) || 0),
    0
  );

  document.getElementById("totalObtained").innerText =
    `${totalObtained} / ${course.totalMarks}`;

  document.getElementById("totalPercent").innerText =
    ((totalObtained / course.totalMarks) * 100 || 0).toFixed(1) + "%";

  const finished = course.evaluatives.filter(
    e => e.date && e.date < todayISO()
  );

  if (finished.length === 0) {
    document.getElementById("currentEval").innerText = "N/A";
    document.getElementById("currentPercent").innerText = "N/A";
    return;
  }

  const max = finished.reduce((s, e) => s + (Number(e.max) || 0), 0);
  const got = finished.reduce((s, e) => s + (Number(e.obtained) || 0), 0);

  document.getElementById("currentEval").innerText = `${got} / ${max}`;
  document.getElementById("currentPercent").innerText =
    ((got / max) * 100 || 0).toFixed(1) + "%";
}

/**********************************************************
 * CALENDAR LOGIC (calendar.html)
 **********************************************************/
function renderCalendar(year, month) {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;

  grid.innerHTML = "";

  const data = loadData();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";

    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cell.innerHTML = `<span class="day-num">${day}</span>`;

    data.courses.forEach(course => {
      course.evaluatives.forEach(ev => {
        if (ev.date === dateStr) {
          const pill = document.createElement("div");
          pill.className = "calendar-pill";
          pill.textContent = ev.name;
          pill.onclick = () => {
            window.location.href = `course.html?id=${course.id}`;
          };
          cell.appendChild(pill);
        }
      });
    });

    grid.appendChild(cell);
  }
}

/**********************************************************
 * BOOTSTRAP
 **********************************************************/
document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  renderCourse();
});
