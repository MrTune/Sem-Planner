// Data Structure
const DEFAULT_COURSES = Array.from({ length: 7 }, (_, i) => ({
    id: `course_${i + 1}`,
    name: `Course ${i + 1}: Subject Name`,
    totalMarks: 0,
    components: []
}));

// Storage Helpers
const Storage = {
    get: () => {
        const data = localStorage.getItem('semester_planner_data');
        if (!data) return DEFAULT_COURSES;
        const parsed = JSON.parse(data);
        // Ensure totalMarks is calculated if components were added/modified
        return parsed.map(c => ({
            ...c,
            totalMarks: c.components.reduce((sum, comp) => sum + (Number(comp.max) || 0), 0)
        }));
    },
    save: (data) => {
        localStorage.setItem('semester_planner_data', JSON.stringify(data));
    }
};

// Utils
function calculateCourseStats(course) {
    let obtained = 0;
    course.components.forEach(c => {
        if (c.obtained !== null && c.obtained !== "") {
            obtained += Number(c.obtained);
        }
    });
    
    const percentage = course.totalMarks > 0 ? (obtained / course.totalMarks) * 100 : 0;

    // Timeline-aware metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentObtained = 0;
    let currentMax = 0;
    let finishedCount = 0;
    
    course.components.forEach(comp => {
        const compDate = new Date(comp.date);
        if (compDate < today) {
            finishedCount++;
            if (comp.obtained !== null && comp.obtained !== "") {
                currentObtained += Number(comp.obtained);
            }
            currentMax += Number(comp.max) || 0;
        }
    });
    
    const currentPercentage = currentMax > 0 ? ((currentObtained / currentMax) * 100).toFixed(1) : "N/A";

    return { 
        obtained, 
        percentage: percentage.toFixed(1),
        currentObtained,
        currentMax,
        currentPercentage,
        hasFinished: finishedCount > 0
    };
}

// Render Logic
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.endsWith('index.html') || path.endsWith('/') || path === '') {
        // Initial render
        const courses = Storage.get();
        renderDashboard(courses);
        renderUpcoming(); // Rebuilds from localStorage
        
        // Refresh button listener
        const refreshBtn = document.getElementById('refresh-upcoming');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => renderUpcoming());
        }

        // Listen for storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'semester_planner_data') {
                const updatedCourses = JSON.parse(e.newValue);
                renderDashboard(updatedCourses);
                renderUpcoming();
            }
        });
    } else if (path.endsWith('course.html')) {
        const courses = Storage.get();
        renderCoursePage(courses);
    } else if (path.endsWith('calendar.html')) {
        const courses = Storage.get();
        renderCalendar(courses);
    }
});

function renderCalendar(courses) {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    // Collect all evaluatives
    const allEvaluatives = [];
    courses.forEach(course => {
        course.components.forEach(comp => {
            allEvaluatives.push({
                ...comp,
                courseId: course.id,
                courseName: course.name
            });
        });
    });

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let html = '';
    // Show 6 months from January 2026 (the semester)
    for (let m = 0; m < 6; m++) {
        const year = 2026;
        const monthIndex = m; // Jan to June
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const startDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
        const daysInMonth = lastDay.getDate();

        html += `
            <div class="month-container">
                <h3 class="month-title">${months[monthIndex]} ${year}</h3>
                <div class="calendar-grid">
                    <div class="calendar-day-header">SUN</div>
                    <div class="calendar-day-header">MON</div>
                    <div class="calendar-day-header">TUE</div>
                    <div class="calendar-day-header">WED</div>
                    <div class="calendar-day-header">THU</div>
                    <div class="calendar-day-header">FRI</div>
                    <div class="calendar-day-header">SAT</div>
        `;

        // Empty cells before start of month
        for (let i = 0; i < startDayOfWeek; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Actual days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const evalsOnDay = allEvaluatives.filter(ev => ev.date === dateStr);
            
            html += `
                <div class="calendar-day">
                    <div class="day-number">${day}</div>
                    ${evalsOnDay.map(ev => {
                        const evDate = new Date(ev.date);
                        evDate.setHours(0,0,0,0);
                        
                        let urgencyClass = '';
                        if (evDate < today) {
                            urgencyClass = 'finished';
                        } else {
                            const diff = Math.ceil((evDate - today) / (1000 * 60 * 60 * 24));
                            if (diff <= 3) urgencyClass = 'urgency-red';
                            else if (diff <= 7) urgencyClass = 'urgency-yellow';
                            else urgencyClass = 'urgency-green';
                        }

                        return `
                            <a href="course.html?id=${ev.courseId}" 
                               class="calendar-pill ${urgencyClass}" 
                               title="${ev.courseName}: ${ev.name}">
                                ${ev.name}
                            </a>
                        `;
                    }).join('')}
                </div>
            `;
        }

        html += '</div></div>';
    }

    container.innerHTML = html;
}

function renderUpcoming() {
    const list = document.getElementById('upcoming-list');
    if (!list) return;

    // Read FRESH data from localStorage
    const courses = Storage.get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [];
    courses.forEach(course => {
        course.components.forEach(comp => {
            const compDate = new Date(comp.date);
            // Show all evaluatives in upcoming, but label them differently if past
            upcoming.push({
                ...comp,
                courseName: course.name,
                daysLeft: Math.ceil((compDate - today) / (1000 * 60 * 60 * 24))
            });
        });
    });

    // Only show "Upcoming" (today or future) OR "Overdue" (past but not obtained)
    const displayItems = upcoming.filter(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0,0,0,0);
        return itemDate >= today || (itemDate < today && (item.obtained === null || item.obtained === ""));
    });

    displayItems.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (displayItems.length === 0) {
        list.innerHTML = '<div class="no-upcoming">No upcoming evaluatives. All caught up!</div>';
        return;
    }

    list.innerHTML = displayItems.map(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0,0,0,0);
        
        let urgencyClass = 'urgency-green';
        let daysText = '';

        if (itemDate < today) {
            urgencyClass = 'urgency-red';
            daysText = 'Overdue';
        } else if (itemDate.getTime() === today.getTime()) {
            urgencyClass = 'urgency-red';
            daysText = 'Today';
        } else {
            if (item.daysLeft <= 3) urgencyClass = 'urgency-red';
            else if (item.daysLeft <= 7) urgencyClass = 'urgency-yellow';
            daysText = `${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'} left`;
        }

        const month = itemDate.toLocaleString('default', { month: 'short' }).toUpperCase();
        const day = itemDate.getDate();

        return `
            <div class="eval-card">
                <div class="calendar-box ${urgencyClass}">
                    <span class="cal-month" style="color: var(--text-primary)">${month}</span>
                    <span class="cal-day" style="color: var(--text-primary)">${day}</span>
                </div>
                <div class="eval-details">
                    <span class="comp-name">${item.name}</span>
                    <span class="course-name">${item.courseName}</span>
                    <div class="date-row">
                        <span class="urgency-badge ${urgencyClass}" style="color: var(--text-primary)">${daysText}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderDashboard(courses) {
    const grid = document.getElementById('course-grid');
    if (!grid) return;

    grid.innerHTML = courses.map(course => {
        const stats = calculateCourseStats(course);
        return `
            <a href="course.html?id=${course.id}" class="course-card">
                <h3>${course.name}</h3>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${stats.percentage}%"></div>
                </div>
                <div class="card-stats">
                    <span class="progress-text">${stats.obtained} / ${course.totalMarks}</span>
                    <span class="percentage-text">${stats.percentage}%</span>
                </div>
            </a>
        `;
    }).join('');
}

function renderCoursePage(courses) {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');
    const course = courses.find(c => c.id === courseId);

    if (!course) {
        document.body.innerHTML = '<div class="container"><h1>Course not found</h1><a href="index.html">Back</a></div>';
        return;
    }

    let currentSort = 'upcoming';

    // Editable Course Title
    const header = document.querySelector('header');
    header.innerHTML = `
        <a href="index.html" class="back-link">← Back to Dashboard</a>
        <input type="text" id="course-name-input" class="course-title-input" value="${course.name}">
    `;

    const nameInput = document.getElementById('course-name-input');
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            course.name = e.target.value;
            Storage.save(courses);
        });
    }

    // Header Stats
    const updateStats = () => {
        const stats = calculateCourseStats(course);
        const tm = document.getElementById('total-marks');
        const pc = document.getElementById('percentage');
        const cm = document.getElementById('current-marks');
        const cp = document.getElementById('current-percentage');
        if (tm) tm.textContent = `${stats.obtained} / ${course.totalMarks}`;
        if (pc) pc.textContent = `${stats.percentage}%`;
        if (cm) cm.textContent = stats.hasFinished ? `${stats.currentObtained} / ${stats.currentMax}` : "0 / 0";
        if (cp) cp.textContent = stats.currentPercentage + (stats.hasFinished ? "%" : "");
    };

    updateStats();

    const GROUP_CONFIG = {
        'Lab': 'blue', 'Lab Test': 'blue', 'Quiz': 'amber', 'Midsem': 'red',
        'Compre': 'red', 'Project': 'purple', 'Assignment': 'grey', 'Exit Test': 'green'
    };

    // Components Table
    const renderTable = () => {
        const tbody = document.getElementById('components-list');
        if (!tbody) return;
        if (course.components.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-eval-msg">No evaluatives added yet</td></tr>';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let sorted = [...course.components].map((c, i) => ({ ...c, originalIndex: i }));
        if (currentSort === 'weightage') sorted.sort((a, b) => (Number(b.max) || 0) - (Number(a.max) || 0));
        else if (currentSort === 'upcoming') sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
        else if (currentSort === 'furthest') sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
        else if (currentSort === 'groups') {
            sorted.sort((a, b) => {
                if (!a.group && !b.group) return 0;
                if (!a.group) return 1;
                if (!b.group) return -1;
                return a.group.localeCompare(b.group);
            });
        }

        tbody.innerHTML = sorted.map((comp) => {
            const gColor = GROUP_CONFIG[comp.group] || 'transparent';
            const compDate = new Date(comp.date);
            compDate.setHours(0, 0, 0, 0);
            const isLocked = compDate >= today;
            
            return `
                <tr class="eval-row" style="border-left: 4px solid var(--group-${gColor})">
                    <td><input type="text" value="${comp.name}" data-index="${comp.originalIndex}" class="name-input"></td>
                    <td><input type="date" value="${comp.date}" data-index="${comp.originalIndex}" class="date-input"></td>
                    <td><input type="number" min="1" value="${comp.max}" data-index="${comp.originalIndex}" class="max-marks-input"></td>
                    <td>
                        <input type="number" 
                               min="0" 
                               max="${comp.max}" 
                               value="${comp.obtained !== null ? comp.obtained : ''}" 
                               data-index="${comp.originalIndex}" 
                               class="marks-input ${isLocked ? 'locked-input' : ''}" 
                               placeholder="${isLocked ? 'Locked' : '-'}"
                               ${isLocked ? 'disabled' : ''}>
                    </td>
                    <td>
                        <div class="row-actions">
                            <div class="dropdown">
                                <button class="btn-group-icon">📁</button>
                                <div class="dropdown-content">
                                    ${Object.keys(GROUP_CONFIG).map(g => `<a href="#" class="group-select" data-index="${comp.originalIndex}" data-group="${g}">${g}</a>`).join('')}
                                    <a href="#" class="group-select" data-index="${comp.originalIndex}" data-group="">None</a>
                                </div>
                            </div>
                            <button class="btn-delete" data-index="${comp.originalIndex}">×</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    };

    renderTable();

    const section = document.querySelector('.components-section');
    if (section && !document.querySelector('.course-controls')) {
        const controls = document.createElement('div');
        controls.className = 'course-controls';
        controls.innerHTML = `
            <div class="sort-controls">
                <button class="btn-sort active" data-sort="upcoming">Upcoming</button>
                <button class="btn-sort" data-sort="weightage">Weightage</button>
                <button class="btn-sort" data-sort="groups">Groups</button>
                <button class="btn-sort" data-sort="furthest">Furthest</button>
            </div>
            <div class="course-actions">
                <button id="clear-all-btn" class="btn-clear">Clear All</button>
                <button id="add-eval-btn" class="btn-refresh">+ Add</button>
            </div>`;
        section.insertBefore(controls, section.querySelector('.table-container'));
    }

    document.getElementById('add-eval-btn')?.addEventListener('click', () => {
        course.components.push({ name: "New Evaluative", date: new Date().toISOString().split('T')[0], max: 10, obtained: null, group: "" });
        course.totalMarks = course.components.reduce((sum, c) => sum + Number(c.max), 0);
        Storage.save(courses); renderTable(); updateStats();
    });

    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
        course.components = []; course.totalMarks = 0;
        Storage.save(courses); renderTable(); updateStats();
    });

    document.querySelectorAll('.btn-sort').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentSort = e.target.dataset.sort;
            document.querySelectorAll('.btn-sort').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active'); renderTable();
        });
    });

    const tbody = document.getElementById('components-list');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            if (e.target.classList.contains('btn-delete')) {
                course.components.splice(idx, 1);
                course.totalMarks = course.components.reduce((sum, c) => sum + Number(c.max), 0);
                Storage.save(courses); renderTable(); updateStats();
            } else if (e.target.classList.contains('group-select')) {
                e.preventDefault(); course.components[idx].group = e.target.dataset.group;
                Storage.save(courses); renderTable();
            }
        });
        tbody.addEventListener('input', (e) => {
            const idx = e.target.dataset.index; const val = e.target.value;
            if (e.target.classList.contains('name-input')) course.components[idx].name = val;
            else if (e.target.classList.contains('marks-input')) course.components[idx].obtained = val === '' ? null : Number(val);
            else if (e.target.classList.contains('date-input')) course.components[idx].date = val;
            else if (e.target.classList.contains('max-marks-input')) {
                course.components[idx].max = Number(val);
                course.totalMarks = course.components.reduce((sum, c) => sum + Number(c.max), 0);
            }
            Storage.save(courses); updateStats();
        });
    }
}