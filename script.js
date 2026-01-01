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

    if (path.endsWith('index.html') || path.endsWith('/')) {
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
    }
});

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
            if (compDate >= today) {
                upcoming.push({
                    ...comp,
                    courseName: course.name,
                    daysLeft: Math.ceil((compDate - today) / (1000 * 60 * 60 * 24))
                });
            }
        });
    });

    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcoming.length === 0) {
        list.innerHTML = '<div class="no-upcoming">No upcoming evaluatives. All caught up!</div>';
        return;
    }

    list.innerHTML = upcoming.map(item => {
        let urgencyClass = 'urgency-green';
        if (item.daysLeft <= 3) urgencyClass = 'urgency-red';
        else if (item.daysLeft <= 7) urgencyClass = 'urgency-yellow';

        const daysText = item.daysLeft === 0 ? 'Today' : `${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'} left`;
        
        const dateObj = new Date(item.date);
        const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
        const day = dateObj.getDate();

        return `
            <div class="eval-card">
                <div class="calendar-box ${urgencyClass}">
                    <span class="cal-month">${month}</span>
                    <span class="cal-day">${day}</span>
                </div>
                <div class="eval-details">
                    <span class="comp-name">${item.name}</span>
                    <span class="course-name">${item.courseName}</span>
                    <div class="date-row">
                        <span class="urgency-badge ${urgencyClass}">${daysText}</span>
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
                <span class="progress-text">${stats.obtained} / ${course.totalMarks}</span>
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

    // Editable Course Title
    const header = document.querySelector('header');
    header.innerHTML = `
        <a href="index.html" class="back-link">← Back to Dashboard</a>
        <input type="text" id="course-name-input" class="course-title-input" value="${course.name}">
    `;

    document.getElementById('course-name-input').addEventListener('input', (e) => {
        course.name = e.target.value;
        Storage.save(courses);
    });

    // Header Stats
    const updateStats = () => {
        const stats = calculateCourseStats(course);
        document.getElementById('total-marks').textContent = `${stats.obtained} / ${course.totalMarks}`;
        document.getElementById('percentage').textContent = `${stats.percentage}%`;
        
        document.getElementById('current-marks').textContent = stats.hasFinished ? `${stats.currentObtained} / ${stats.currentMax}` : "0 / 0";
        document.getElementById('current-percentage').textContent = stats.currentPercentage + (stats.hasFinished ? "%" : "");
    };

    updateStats();

    // Components Table
    const renderTable = () => {
        const tbody = document.getElementById('components-list');
        if (course.components.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-eval-msg">No evaluatives added yet</td></tr>';
        } else {
            tbody.innerHTML = course.components.map((comp, index) => `
                <tr>
                    <td>
                        <input type="text" 
                               value="${comp.name}"
                               data-index="${index}"
                               class="name-input"
                               placeholder="Component Name">
                    </td>
                    <td>
                        <input type="date" 
                               value="${comp.date}"
                               data-index="${index}"
                               class="date-input">
                    </td>
                    <td>
                        <input type="number" 
                               min="1" 
                               value="${comp.max}"
                               data-index="${index}"
                               class="max-marks-input">
                    </td>
                    <td>
                        <input type="number" 
                               min="0" 
                               max="${comp.max}" 
                               value="${comp.obtained !== null ? comp.obtained : ''}"
                               data-index="${index}"
                               class="marks-input"
                               placeholder="-">
                    </td>
                    <td>
                        <button class="btn-delete" data-index="${index}">×</button>
                    </td>
                </tr>
            `).join('');
        }
    };

    renderTable();

    // Add Component Button
    const section = document.querySelector('.components-section');
    const actionBtns = document.createElement('div');
    actionBtns.className = 'course-actions';
    actionBtns.innerHTML = `
        <button id="clear-all-btn" class="btn-clear">Clear All Evaluatives</button>
        <button id="add-eval-btn" class="btn-refresh">+ Add Evaluative</button>
    `;
    section.appendChild(actionBtns);

    document.getElementById('add-eval-btn').addEventListener('click', () => {
        const todayStr = new Date().toISOString().split('T')[0];
        course.components.push({
            name: "New Evaluative",
            date: todayStr,
            max: 10,
            obtained: null
        });
        course.totalMarks = course.components.reduce((sum, c) => sum + Number(c.max), 0);
        Storage.save(courses);
        renderTable();
        updateStats();
    });

    document.getElementById('clear-all-btn').addEventListener('click', () => {
        course.components = [];
        course.totalMarks = 0;
        Storage.save(courses);
        renderTable();
        updateStats();
    });

    // Event Listeners for Inputs and Actions
    const tbody = document.getElementById('components-list');
    tbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const index = parseInt(e.target.dataset.index);
            course.components.splice(index, 1);
            course.totalMarks = course.components.reduce((sum, c) => sum + Number(c.max), 0);
            Storage.save(courses);
            renderTable();
            updateStats();
        }
    });
    tbody.addEventListener('input', (e) => {
        const index = e.target.dataset.index;
        const val = e.target.value;

        if (e.target.classList.contains('name-input')) {
            course.components[index].name = val;
        } else if (e.target.classList.contains('marks-input')) {
            course.components[index].obtained = val === '' ? null : Number(val);
        } else if (e.target.classList.contains('date-input')) {
            course.components[index].date = val;
        } else if (e.target.classList.contains('max-marks-input')) {
            course.components[index].max = Number(val);
            course.totalMarks = course.components.reduce((sum, c) => sum + Number(c.max), 0);
        }
        
        Storage.save(courses);
        updateStats();
    });
}