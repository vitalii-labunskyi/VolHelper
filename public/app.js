const API_BASE = '/api';
let currentUser = null;
let authToken = localStorage.getItem('authToken');

if (authToken) {
    checkAuth();
}

// Prevent double submits and show loading state on buttons
function withSubmitLock(btn, fn) {
    return async () => {
        if (btn && btn.dataset.loading === '1') return;
        const original = btn ? btn.innerHTML : '';
        if (btn) {
            btn.dataset.loading = '1';
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Обробка...';
        }
        try { await fn(); } finally {
            if (btn) {
                btn.disabled = false;
                btn.dataset.loading = '0';
                btn.innerHTML = original;
            }
        }
    };
}

// Short info modal for confirmations
function showInfoModal(title, message, autoCloseMs = 3000) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body"><p class="mb-0">${message}</p></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal, { backdrop: 'static', keyboard: true });
    bsModal.show();
    if (autoCloseMs) setTimeout(() => bsModal.hide(), autoCloseMs);
    modal.addEventListener('hidden.bs.modal', () => document.body.removeChild(modal));
}

// Navigation event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Handle navigation clicks
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                const sectionId = href.substring(1);
                showSection(sectionId);
            }
        });
    });
    
    // Handle buttons that trigger navigation
    document.querySelectorAll('button[onclick*="showSection"]').forEach(button => {
        const onclickAttr = button.getAttribute('onclick');
        if (onclickAttr) {
            const match = onclickAttr.match(/showSection\(['"]([^'"]+)['"]\)/);
            if (match) {
                const sectionId = match[1];
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    showSection(sectionId);
                });
            }
        }
    });
});

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    if (sectionId === 'dashboard' && currentUser) {
        loadDashboard();
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastBody = toast.querySelector('.toast-body');
    const toastHeader = toast.querySelector('.toast-header');
    
    toastBody.textContent = message;
    toastHeader.className = `toast-header bg-${type} text-white`;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

async function apiRequest(endpoint, options = {}) {
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    };
    
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Помилка сервера');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function checkAuth() {
    try {
        const userData = await apiRequest('/auth/profile');
        currentUser = userData.user;
        updateNavigation(true);
    } catch (error) {
        logout();
    }
}

function updateNavigation(isAuthenticated) {
    const loginNavItem = document.getElementById('loginNavItem');
    const dashboardNavItem = document.getElementById('dashboardNavItem');
    const logoutNavItem = document.getElementById('logoutNavItem');
    
    if (isAuthenticated) {
        loginNavItem.classList.add('d-none');
        dashboardNavItem.classList.remove('d-none');
        logoutNavItem.classList.remove('d-none');
    } else {
        loginNavItem.classList.remove('d-none');
        dashboardNavItem.classList.add('d-none');
        logoutNavItem.classList.add('d-none');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateNavigation(false);
    showSection('home');
    showToast('Ви вийшли з системи', 'info');
}

document.getElementById('helpRequestForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    withSubmitLock(submitBtn, async () => {
        const formData = new FormData(e.target);
        const requestData = {
            title: formData.get('title'),
            description: formData.get('description'),
            category: formData.get('category'),
            priority: formData.get('priority'),
            location: {
                address: formData.get('address'),
                city: formData.get('city'),
                region: formData.get('region')
            },
            contactInfo: {
                name: formData.get('contactName'),
                phone: formData.get('contactPhone'),
                email: formData.get('contactEmail'),
                alternateContact: formData.get('alternateContact')
            },
            deadline: formData.get('deadline') || null
        };
        try {
            await apiRequest('/requests', { method: 'POST', body: JSON.stringify(requestData) });
            e.target.reset();
            showInfoModal('Дякуємо!', 'Ваша заявка подана до розгляду. Очікуйте на зв\'язок.', 3000);
            showSection('home');
        } catch (error) {
            showToast(error.message, 'danger');
        }
    })();
});

document.getElementById('volunteerRegisterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    withSubmitLock(submitBtn, async () => {
        const formData = new FormData(e.target);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            phone: formData.get('phone'),
            skills: formData.get('skills') ? formData.get('skills').split(',').map(s => s.trim()) : [],
            location: { city: formData.get('city'), region: formData.get('region') },
            availability: formData.get('availability')
        };
        try {
            const response = await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
            authToken = response.token;
            currentUser = response.user;
            localStorage.setItem('authToken', authToken);
            updateNavigation(true);
            showToast('Реєстрація успішна!', 'success');
            showSection('dashboard');
        } catch (error) {
            showToast(error.message, 'danger');
        }
    })();
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    withSubmitLock(submitBtn, async () => {
        const formData = new FormData(e.target);
        const loginData = { email: formData.get('email'), password: formData.get('password') };
        try {
            const response = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(loginData) });
            authToken = response.token;
            currentUser = response.user;
            localStorage.setItem('authToken', authToken);
            updateNavigation(true);
            showToast('Успішний вхід!', 'success');
            showSection('dashboard');
        } catch (error) {
            showToast(error.message, 'danger');
        }
    })();
});

function loadDashboard() {
    if (!currentUser) return;
    
    if (currentUser.role === 'admin') {
        const adminNavItem = document.getElementById('adminNavItem');
        if (adminNavItem) adminNavItem.classList.remove('d-none');
    }
    const dashLogout = document.getElementById('dashboardLogoutBtn');
    if (dashLogout) {
        dashLogout.classList.remove('d-none');
        dashLogout.onclick = () => logout();
    }
    
    loadRequests();
    loadProfile();
}

async function loadRequests() {
    try {
        const params = new URLSearchParams();
        const statusFilter = document.getElementById('statusFilter').value;
        if (statusFilter) params.append('status', statusFilter);
        
        const requests = await apiRequest(`/requests?${params}`);
        displayRequests(requests);
    } catch (error) {
        showToast('Помилка завантаження заявок: ' + error.message, 'danger');
    }
}

function displayRequests(requests) {
    const requestsList = document.getElementById('requestsList');
    
    if (requests.length === 0) {
        requestsList.innerHTML = '<div class="text-center text-muted py-4">Заявок не знайдено</div>';
        return;
    }
    
    requestsList.innerHTML = requests.map(request => {
        const takeBtn = (request.status === 'new' && currentUser.role === 'volunteer')
          ? `<button class=\"btn btn-sm btn-primary me-2\" data-action=\"assign\" data-id=\"${request.id}\">Взяти</button>`
          : '';
        return `
        <div class=\"card request-card priority-${request.priority} mb-3\">\n            <div class=\"card-body\">\n                <div class=\"d-flex justify-content-between align-items-start mb-2\">\n                    <h5 class=\"card-title mb-0\">${request.title}</h5>\n                    <span class=\"badge status-badge status-${request.status}\">${getStatusText(request.status)}</span>\n                </div>\n                <p class=\"text-muted mb-2\">\n                    <i class=\"fas fa-map-marker-alt me-1\"></i>${request.location.city}\n                    <span class=\"ms-3\"><i class=\"fas fa-tag me-1\"></i>${getCategoryText(request.category)}</span>\n                    <span class=\"ms-3\"><i class=\"fas fa-exclamation-triangle me-1\"></i>${getPriorityText(request.priority)}</span>\n                </p>\n                <p class=\"card-text\">${request.description.substring(0, 150)}${request.description.length > 150 ? '...' : ''}</p>\n                <div class=\"d-flex justify-content-between align-items-center\">\n                    <small class=\"text-muted\">\n                        <i class=\"fas fa-clock me-1\"></i>${new Date(request.createdAt).toLocaleDateString('uk')}\n                    </small>\n                    <div>\n                        ${takeBtn}\n                        <button class=\"btn btn-sm btn-outline-primary\" data-action=\"details\" data-id=\"${request.id}\">Деталі</button>\n                    </div>\n                </div>\n            </div>\n        </div>`;
    }).join('');
}

async function assignToSelf(requestId) {
    try {
        await apiRequest(`/requests/${requestId}/assign`, {
            method: 'PUT',
            body: JSON.stringify({})
        });
        showToast('Заявку призначено вам!', 'success');
        loadRequests();
    } catch (error) {
        showToast(error.message, 'danger');
    }
}

async function viewRequest(requestId) {
    try {
        const request = await apiRequest(`/requests/${requestId}`);
        showRequestModal(request);
    } catch (error) {
        showToast(error.message, 'danger');
    }
}

function showRequestModal(request) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${request.title}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <strong>Статус:</strong> <span class="badge status-badge status-${request.status}">${getStatusText(request.status)}</span>
                        </div>
                        <div class="col-md-6">
                            <strong>Пріоритет:</strong> <span class="badge bg-secondary">${getPriorityText(request.priority)}</span>
                        </div>
                    </div>
                    <div class="mb-3">
                        <strong>Категорія:</strong> ${getCategoryText(request.category)}
                    </div>
                    <div class="mb-3">
                        <strong>Опис:</strong>
                        <p>${request.description}</p>
                    </div>
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <strong>Адреса:</strong> ${request.location.address}, ${request.location.city}
                        </div>
                        <div class="col-md-6">
                            <strong>Контакт:</strong> ${request.contactInfo.name}, ${request.contactInfo.phone}
                        </div>
                    </div>
                    ${request.assignedVolunteer ? `
                        <div class="mb-3">
                            <strong>Призначений волонтер:</strong> ${request.assignedVolunteer.name} (${request.assignedVolunteer.phone})
                        </div>
                    ` : ''}
                    ${canChangeStatus(request) ? `
                        <div class="mb-3">
                            <label class="form-label"><strong>Змінити статус:</strong></label>
                            <select class="form-select" id="statusSelect">
                                <option value="new" ${request.status === 'new' ? 'selected' : ''}>Новий</option>
                                <option value="assigned" ${request.status === 'assigned' ? 'selected' : ''}>Призначений</option>
                                <option value="in_progress" ${request.status === 'in_progress' ? 'selected' : ''}>В роботі</option>
                                <option value="completed" ${request.status === 'completed' ? 'selected' : ''}>Завершений</option>
                                <option value="cancelled" ${request.status === 'cancelled' ? 'selected' : ''}>Скасований</option>
                            </select>
                        </div>
                    ` : ''}
                    <div class="notes-section">
                        <strong>Нотатки:</strong>
                        <div class="mt-2" id="notesList">
                            ${(request.Notes || []).map(note => `
                                <div class="note-item">
                                    <small class="text-muted">${note.author.name} - ${new Date(note.createdAt).toLocaleString('uk')}</small>
                                    <p class="mb-0">${note.text}</p>
                                </div>
                            `).join('')}
                        </div>
                        <div class="mt-3">
                            <textarea class="form-control" id="newNote" placeholder="Додати нотатку..."></textarea>
                            <button class="btn btn-sm btn-primary mt-2" onclick="addNote('${request.id}')">Додати нотатку</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    ${canChangeStatus(request) ? `
                        <button type="button" class="btn btn-primary" onclick="updateRequestStatus('${request.id}')">Зберегти статус</button>
                    ` : ''}
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрити</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
}

function canChangeStatus(request) {
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'volunteer' && request.assignedVolunteer && 
        request.assignedVolunteer.id === currentUser.id) return true;
    return false;
}

async function updateRequestStatus(requestId) {
    const statusSelect = document.getElementById('statusSelect');
    const newStatus = statusSelect.value;
    
    try {
        await apiRequest(`/requests/${requestId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        showToast('Статус оновлено!', 'success');
        bootstrap.Modal.getInstance(document.querySelector('.modal.show')).hide();
        loadRequests();
    } catch (error) {
        showToast(error.message, 'danger');
    }
}

async function addNote(requestId) {
    const noteText = document.getElementById('newNote').value.trim();
    if (!noteText) return;
    
    try {
        await apiRequest(`/requests/${requestId}/notes`, {
            method: 'POST',
            body: JSON.stringify({ text: noteText })
        });
        
        showToast('Нотатку додано!', 'success');
        document.getElementById('newNote').value = '';
        
        const request = await apiRequest(`/requests/${requestId}`);
        const notesList = document.getElementById('notesList');
        notesList.innerHTML = (request.Notes || []).map(note => `
            <div class="note-item">
                <small class="text-muted">${note.author.name} - ${new Date(note.createdAt).toLocaleString('uk')}</small>
                <p class="mb-0">${note.text}</p>
            </div>
        `).join('');
    } catch (error) {
        showToast(error.message, 'danger');
    }
}

function loadProfile() {
    if (!currentUser) return;
    
    const profileInfo = document.getElementById('profileInfo');
    profileInfo.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h5>Особисті дані</h5>
                <p><strong>Ім'я:</strong> ${currentUser.name}</p>
                <p><strong>Email:</strong> ${currentUser.email}</p>
                <p><strong>Телефон:</strong> ${currentUser.phone}</p>
                <p><strong>Роль:</strong> ${currentUser.role === 'admin' ? 'Адміністратор' : 'Волонтер'}</p>
                <p><strong>Навички:</strong> ${currentUser.skills.join(', ') || 'Не вказані'}</p>
                <p><strong>Місцезнаходження:</strong> ${currentUser.location.city || 'Не вказано'}</p>
                <p><strong>Доступність:</strong> ${getAvailabilityText(currentUser.availability)}</p>
            </div>
        </div>
    `;
}

document.getElementById('dashboardMenu').addEventListener('click', (e) => {
    if (e.target.dataset.tab) {
        e.preventDefault();
        
        document.querySelectorAll('#dashboardMenu .list-group-item').forEach(item => 
            item.classList.remove('active'));
        e.target.classList.add('active');
        
        document.querySelectorAll('.dashboard-tab').forEach(tab => 
            tab.classList.remove('active'));
        document.getElementById(e.target.dataset.tab + 'Tab').classList.add('active');
    }
});

function getStatusText(status) {
    const statusMap = {
        'new': 'Новий',
        'assigned': 'Призначений',
        'in_progress': 'В роботі',
        'completed': 'Завершений',
        'cancelled': 'Скасований'
    };
    return statusMap[status] || status;
}

function getCategoryText(category) {
    const categoryMap = {
        'medical': 'Медична допомога',
        'humanitarian': 'Гуманітарна допомога',
        'evacuation': 'Евакуація',
        'psychological': 'Психологічна підтримка',
        'legal': 'Юридична допомога',
        'technical': 'Технічна допомога',
        'translation': 'Переклад',
        'other': 'Інше'
    };
    return categoryMap[category] || category;
}

function getPriorityText(priority) {
    const priorityMap = {
        'low': 'Низький',
        'medium': 'Середній',
        'high': 'Високий',
        'urgent': 'Термінево'
    };
    return priorityMap[priority] || priority;
}

function getAvailabilityText(availability) {
    const availabilityMap = {
        'flexible': 'Гнучкий графік',
        'fulltime': 'Повний робочий день',
        'parttime': 'Неповний робочий день',
        'weekends': 'Тільки вихідні'
    };
    return availabilityMap[availability] || availability;
}
