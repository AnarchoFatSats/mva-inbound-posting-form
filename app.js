// Configuration - Now handled by build-time injection and AppConfig module
const API_ENDPOINT = 'https://9qtb4my1ij.execute-api.us-east-1.amazonaws.com/prod/leads';
const EXPORT_ENDPOINT = 'https://9qtb4my1ij.execute-api.us-east-1.amazonaws.com/prod/export';
const REFRESH_INTERVAL = 10000; // 10 seconds

// Configuration is now handled by AppConfig module - no more complex loading logic needed!
function getAppConfig() {
    // Use AppConfig module if available, otherwise fallback
    if (window.AppConfig) {
        return window.AppConfig.get();
    } else if (window.APP_CONFIG) {
        return window.APP_CONFIG;
    } else {
        // Emergency fallback
        return {
            userPoolId: 'us-east-1_lhc964tLD',
            clientId: '5t6mane4fnvineksoqb4ta0iu1',
            apiEndpoint: 'https://9qtb4my1ij.execute-api.us-east-1.amazonaws.com/prod',
            apiUrl: 'https://9qtb4my1ij.execute-api.us-east-1.amazonaws.com/prod'
        };
    }
}

// Approved fallback configuration (no secrets)
const FALLBACK_CONFIG = {
    userPoolId: 'us-east-1_lhc964tLD',
    clientId: '5t6mane4fnvineksoqb4ta0iu1',
    apiEndpoint: 'https://9qtb4my1ij.execute-api.us-east-1.amazonaws.com/prod',
    apiUrl: 'https://9qtb4my1ij.execute-api.us-east-1.amazonaws.com/prod'
};

// Update notification functionality
window.showUpdateNotification = function() {
    // Create notification if it doesn't exist
    let notification = document.getElementById('update-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'update-notification';
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <span class="update-icon">🔄</span>
                <span class="update-text">A new version is available!</span>
                <button class="update-btn" onclick="location.reload()">Update Now</button>
                <button class="update-dismiss" onclick="this.parentElement.parentElement.style.display='none'">×</button>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .update-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4299e1;
                color: white;
                padding: 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                animation: slideIn 0.3s ease-out;
            }
            
            .update-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .update-icon {
                font-size: 20px;
            }
            
            .update-btn {
                background: white;
                color: #4299e1;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                font-weight: 600;
                cursor: pointer;
            }
            
            .update-dismiss {
                background: transparent;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                opacity: 0.8;
                padding: 0;
                margin-left: 8px;
            }
            
            .update-dismiss:hover {
                opacity: 1;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    notification.style.display = 'block';
};

// Cognito token refresh - run every 45 minutes
function setupTokenRefresh() {
    // Function to refresh token
    async function refreshCognitoToken() {
        try {
            if (typeof AmazonCognitoIdentity === 'undefined') {
                console.error('Cognito SDK not loaded, redirecting to login');
                window.location.href = 'login.html';
                return;
            }
            
            // Use AppConfig module for instant Cognito configuration
            const cognitoConfig = window.AppConfig ? 
                window.AppConfig.getCognitoConfig() :
                { UserPoolId: 'us-east-1_lhc964tLD', ClientId: '5t6mane4fnvineksoqb4ta0iu1' };
            
            const userPool = new AmazonCognitoIdentity.CognitoUserPool(cognitoConfig);
            const currentUser = userPool.getCurrentUser();
            
            if (!currentUser) {
                console.error('No user session found, redirecting to login');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            
            // Get session and validate
            await new Promise((resolve, reject) => {
                currentUser.getSession((err, session) => {
                    if (err) {
                        console.error('Error refreshing session:', err);
                        
                        // If session can't be refreshed, redirect to login
                        if (err.name === 'NotAuthorizedException') {
                            localStorage.removeItem('auth_token');
                            localStorage.removeItem('user');
                            window.location.href = 'login.html';
                        }
                        reject(err);
                        return;
                    }
                    
                    if (session && session.isValid()) {
                        // Update tokens in localStorage
                        const accessToken = session.getAccessToken().getJwtToken();
                        const idToken = session.getIdToken().getJwtToken();
                        const refreshToken = session.getRefreshToken().getToken();
                        
                        localStorage.setItem('accessToken', accessToken);
                        localStorage.setItem('idToken', idToken);
                        localStorage.setItem('refreshToken', refreshToken);
                        localStorage.setItem('auth_token', idToken); // For backward compatibility
                        
                        // Get user attributes to ensure user data is up to date
                        currentUser.getUserAttributes((attrErr, attributes) => {
                            if (attrErr) {
                                console.error('Error getting user attributes:', attrErr);
                                resolve();
                                return;
                            }
                            
                            // Update user data in localStorage
                            const userData = JSON.parse(localStorage.getItem('user') || '{}');
                            if (attributes) {
                                attributes.forEach(attr => {
                                    const name = attr.getName();
                                    const value = attr.getValue();
                                    
                                    // Handle custom attributes
                                    if (name === 'custom:role') {
                                        userData.role = value;
                                    } else {
                                        userData[name] = value;
                                    }
                                });
                            }
                            
                            localStorage.setItem('user', JSON.stringify(userData));
                            console.log('Token and user data refreshed successfully');
                            resolve();
                        });
                    } else {
                        console.warn('Session is not valid, redirecting to login');
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('user');
                        window.location.href = 'login.html';
                        reject(new Error('Invalid session'));
                    }
                });
            });
        } catch (error) {
            console.error('Token refresh error:', error);
            // On any error, redirect to login
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }
    
    // Refresh immediately on load
    refreshCognitoToken().catch(error => {
        console.error('Initial token refresh failed:', error);
    });
    
    // Setup periodic refresh (45 minutes = 2,700,000 ms)
    setInterval(() => {
        refreshCognitoToken().catch(error => {
            console.error('Periodic token refresh failed:', error);
        });
    }, 2700000);
}

// Check authentication
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || !user.email) {
        // Not logged in, redirect to login page
        window.location.href = 'login.html';
        return;
    }
    
    // Setup token refresh
    setupTokenRefresh();
    
    // Add user info to header
    const headerControls = document.querySelector('.controls');
    if (headerControls) {
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `
            <span>Welcome, <strong>${user.name || user.email}</strong></span>
            <span class="role-badge ${user.role === 'admin' ? 'role-admin' : 'role-agent'}">
                ${user.role === 'admin' ? 'Admin' : 'Agent'}
            </span>
            <button id="logout-btn" class="btn btn-sm btn-secondary" style="margin-left: 10px;">Logout</button>
        `;
        headerControls.appendChild(userInfo);
        
        // Add logout handler
        document.getElementById('logout-btn').addEventListener('click', () => {
            // Check if Cognito is available
            if (typeof AmazonCognitoIdentity !== 'undefined') {
                // Use AppConfig module for instant Cognito configuration
                const cognitoConfig = window.AppConfig ? 
                    window.AppConfig.getCognitoConfig() :
                    { UserPoolId: 'us-east-1_lhc964tLD', ClientId: '5t6mane4fnvineksoqb4ta0iu1' };
                
                const userPool = new AmazonCognitoIdentity.CognitoUserPool(cognitoConfig);
                        
                        // Get current user and sign out
                        const currentUser = userPool.getCurrentUser();
                        if (currentUser) {
                            currentUser.signOut();
                        }
                        
                        // Clear local storage and redirect to login page
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('user');
                window.location.href = 'login.html';
            } else {
                // Fallback to traditional logout if Cognito is not available
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }
        });
        
        // Show admin link if user is admin
        if (user.role === 'admin') {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.className = 'btn';
            adminLink.textContent = 'Admin Panel';
            headerControls.insertBefore(adminLink, headerControls.firstChild);
        }
    }
    
    // Initialize the app
    initializeApp();
    
    // Hide skeleton loader
    const skeleton = document.getElementById('skeleton-loader');
    if (skeleton) {
        skeleton.style.transition = 'opacity 0.3s ease';
        skeleton.style.opacity = '0';
        setTimeout(() => skeleton.remove(), 300);
    }
    
    // Initialize premium UI features with delay for better perceived performance
    requestAnimationFrame(() => {
        setTimeout(() => {
            initializeStatsAnimation();
            initializeCharts();
        }, 100);
    });
    
    // Log performance metrics
    if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        console.log(`Page load time: ${loadTime}ms`);
    }
});

// Initialize the application after authentication
async function initializeApp() {
    try {
        // Clear any mock data in localStorage
        clearMockData();
        
        // Load configuration - now instant with AppConfig module!
        await loadConfig();
        
        // Start fetching leads immediately - no more timing delays needed!
        fetchLeads();
        
        // Event Listeners
        if (refreshBtn) {
            refreshBtn.addEventListener('click', fetchLeads);
        }
        if (vendorFilter) {
            vendorFilter.addEventListener('change', filterAndRenderLeads);
        }
        if (searchInput) {
            searchInput.addEventListener('input', debounceSearch);
        }
        if (autoRefreshCb) {
            autoRefreshCb.addEventListener('change', toggleAutoRefresh);
        }
        
        // Export Modal Listeners
        if (exportBtn) {
            exportBtn.addEventListener('click', openExportModal);
        }
        if (exportModalClose) {
            exportModalClose.addEventListener('click', closeExportModal);
        }
        if (exportCancelBtn) {
            exportCancelBtn.addEventListener('click', closeExportModal);
        }
        if (exportDownloadBtn) {
            exportDownloadBtn.addEventListener('click', exportLeadsToCsv);
        }
        
        // New Lead Listeners
        if (addLeadBtn) {
            addLeadBtn.addEventListener('click', openAddLeadModal);
        }
        
        // Set default date values for export
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        if (exportEndDate) {
            exportEndDate.valueAsDate = today;
        }
        if (exportStartDate) {
            exportStartDate.valueAsDate = thirtyDaysAgo;
        }
        
        // Focus the search input for better UX
        if (searchInput) {
            searchInput.focus();
        }
        
        // Create the add lead modal
        createAddLeadModal();
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        showError('Failed to initialize application. Please refresh the page.');
    }
}

// Config initialization
let API_KEY = '';

// Simplified configuration using AppConfig module - no more complex loading!
function loadConfig() {
    // Configuration is now handled by AppConfig module - instant access, no async loading!
    console.log('✅ Using AppConfig module - no external loading needed');
    
    if (window.AppConfig) {
        console.log('Configuration debug info:', window.AppConfig.getDebugConfig());
    }
    
    // No more async loading, race conditions, or timing issues!
    return Promise.resolve();
}

// DOM Elements
const vendorFilter = document.getElementById('vendor-filter');
const searchInput = document.getElementById('lead-search');
const refreshBtn = document.getElementById('refresh-btn');
const autoRefreshCb = document.getElementById('auto-refresh');
const leadsTable = document.getElementById('leads-table');
const leadsBody = document.getElementById('leads-body');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const noDataEl = document.getElementById('no-data');
const addLeadBtn = document.getElementById('add-lead-btn'); // New add lead button

// Export Modal Elements
const exportBtn = document.getElementById('export-btn');
const exportModalOverlay = document.getElementById('export-modal-overlay');
const exportModalClose = document.getElementById('export-modal-close');
const exportVendorSelect = document.getElementById('export-vendor');
const exportStartDate = document.getElementById('export-start-date');
const exportEndDate = document.getElementById('export-end-date');
const exportCancelBtn = document.getElementById('export-cancel');
const exportDownloadBtn = document.getElementById('export-download');

// State
let leads = [];
let filteredLeads = []; // Store filtered leads
let vendorCodes = new Set();
let refreshTimer = null;
let expandedLeadId = null;
let allLeads = []; // For export functionality - store all leads
let searchTerm = ''; // Store the current search term
let searchDebounceTimer = null; // For debouncing search input


// Function to clear mock data from localStorage
function clearMockData() {
    localStorage.removeItem('mockDataLoaded');
    localStorage.removeItem('leads');
    console.log('Mock data cleared from localStorage');
}

// Create the add lead modal HTML structure
function createAddLeadModal() {
    // Create modal if it doesn't exist
    if (document.getElementById('add-lead-modal-overlay')) {
        return;
    }
    
    const modalHtml = `
        <div id="add-lead-modal-overlay" class="modal-overlay">
            <div class="modal" style="width: 800px; max-width: 95%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="position: sticky; top: 0; background: white; z-index: 10;">
                    <h3 class="modal-title">Add New Lead</h3>
                    <button class="modal-close" id="add-lead-modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="add-lead-form">
                        <div style="display: flex; flex-direction: column; gap: 20px;">
                            <!-- Basic Lead Information Section -->
                            <div class="form-section">
                                <h4>Lead Information</h4>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                                    <div class="modal-form-group">
                                        <label for="lead-first-name">First Name*</label>
                                        <input type="text" id="lead-first-name" required>
                                    </div>
                                    <div class="modal-form-group">
                                        <label for="lead-last-name">Last Name*</label>
                                        <input type="text" id="lead-last-name" required>
                                    </div>
                                    <div class="modal-form-group">
                                        <label for="lead-email">Email*</label>
                                        <input type="email" id="lead-email" required>
                                    </div>
                                    <div class="modal-form-group">
                                        <label for="lead-phone">Phone*</label>
                                        <input type="tel" id="lead-phone" required>
                                    </div>
                                    <div class="modal-form-group">
                                        <label for="lead-state">State</label>
                                        <input type="text" id="lead-state">
                                    </div>
                                    <div class="modal-form-group">
                                        <label for="lead-zip">Zip Code</label>
                                        <input type="text" id="lead-zip">
                                    </div>
                                    <div class="modal-form-group">
                                        <label for="lead-city">City</label>
                                        <input type="text" id="lead-city">
                                    </div>
                                    <div class="modal-form-group">
                                        <label for="lead-vendor">Vendor Code*</label>
                                        <select id="lead-vendor" required>
                                            <option value="">Select Vendor</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="modal-form-group">
                                    <label for="lead-notes">Notes</label>
                                    <textarea id="lead-notes" rows="3"></textarea>
                                </div>
                            </div>
                            
                            <!-- Qualification Checklist Section -->
                            <div class="form-section">
                                <h4>Qualification Checklist</h4>
                                <div class="qualification-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
                                    <div class="modal-form-group">
                                        <label for="lead-accident-location">Where did the accident happen?</label>
                                        <input type="text" id="lead-accident-location">
                                    </div>
                                    
                                    <div class="modal-form-group">
                                        <label for="lead-incident-type">Incident Type</label>
                                        <select id="lead-incident-type">
                                            <option value="">Select Type</option>
                                            <option value="PFAS">PFAS</option>
                                            <option value="VGA">VGA</option>
                                            <option value="MVA">MVA</option>
                                            <option value="CMVA">CMVA</option>
                                            <option value="PI">PI</option>
                                        </select>
                                    </div>
                                    
                                    <div class="modal-form-group" style="display: none;">
                                        <input type="hidden" id="lead-accident-date">
                                        <div id="lead-deadline-warning" class="deadline-warning" style="display: none;"></div>
                                    </div>
                                    
                                    <div class="modal-form-group">
                                        <label>Was the caller at fault?</label>
                                        <div class="yes-no-options">
                                            <label class="yes-no-label">
                                                <input type="radio" name="at-fault" value="yes">
                                                Yes
                                            </label>
                                            <label class="yes-no-label">
                                                <input type="radio" name="at-fault" value="no">
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div class="modal-form-group">
                                        <label>Does the caller already have an attorney?</label>
                                        <div class="yes-no-options">
                                            <label class="yes-no-label">
                                                <input type="radio" name="has-attorney" value="yes">
                                                Yes
                                            </label>
                                            <label class="yes-no-label">
                                                <input type="radio" name="has-attorney" value="no">
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div class="modal-form-group">
                                        <label>Was the caller injured?</label>
                                        <div class="yes-no-options">
                                            <label class="yes-no-label">
                                                <input type="radio" name="injured" value="yes">
                                                Yes
                                            </label>
                                            <label class="yes-no-label">
                                                <input type="radio" name="injured" value="no">
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div class="modal-form-group">
                                        <label>Did they see a medical professional within 30 days?</label>
                                        <div class="yes-no-options">
                                            <label class="yes-no-label">
                                                <input type="radio" name="medical-30-days" value="yes">
                                                Yes
                                            </label>
                                            <label class="yes-no-label">
                                                <input type="radio" name="medical-30-days" value="no">
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div class="modal-form-group">
                                        <label>Did the at-fault party have insurance?</label>
                                        <div class="yes-no-options">
                                            <label class="yes-no-label">
                                                <input type="radio" name="has-insurance" value="yes" onchange="toggleUmCoverageSection()">
                                                Yes
                                            </label>
                                            <label class="yes-no-label">
                                                <input type="radio" name="has-insurance" value="no" onchange="toggleUmCoverageSection()">
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div id="um-coverage-section" class="modal-form-group" style="display: none;">
                                        <label>If no insurance or hit-and-run: Does the caller have UM coverage?</label>
                                        <div class="yes-no-options">
                                            <label class="yes-no-label">
                                                <input type="radio" name="um-coverage" value="yes">
                                                Yes
                                            </label>
                                            <label class="yes-no-label">
                                                <input type="radio" name="um-coverage" value="no">
                                                No
                                            </label>
                                        </div>
                                        <div id="um-warning" class="insurance-warning" style="display: none;">
                                            Warning: Caller has no insurance and no UM coverage. Recommend disqualifying this lead.
                                        </div>
                                    </div>
                                    
                                    <div class="modal-form-group">
                                        <label>Was it a commercial/government vehicle (and caller knows the entity)?</label>
                                        <div class="yes-no-options">
                                            <label class="yes-no-label">
                                                <input type="radio" name="commercial-vehicle" value="yes">
                                                Yes
                                            </label>
                                            <label class="yes-no-label">
                                                <input type="radio" name="commercial-vehicle" value="no">
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div class="modal-form-group">
                                        <label>Does the caller have proof that the other vehicle was commercial/government?</label>
                                        <div class="yes-no-options">
                                            <label class="yes-no-label">
                                                <input type="radio" name="has-proof" value="yes">
                                                Yes
                                            </label>
                                            <label class="yes-no-label">
                                                <input type="radio" name="has-proof" value="no">
                                                No
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="position: sticky; bottom: 0; background: white; z-index: 10;">
                    <button class="btn btn-secondary" id="add-lead-cancel">Cancel</button>
                    <button class="btn" id="add-lead-submit">Add Lead</button>
                </div>
            </div>
        </div>
    `;
    
    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add event listeners
    document.getElementById('add-lead-modal-close').addEventListener('click', closeAddLeadModal);
    document.getElementById('add-lead-cancel').addEventListener('click', closeAddLeadModal);
    document.getElementById('add-lead-submit').addEventListener('click', handleLeadSubmit);
    
    // Add event listener for accident date to check deadline
    document.getElementById('lead-accident-date').addEventListener('change', checkAddLeadDeadline);
    
    // Update the table header in the leads-table element at the top of the file
    const tableHeader = document.querySelector('#leads-table thead tr');
    if (tableHeader) {
        tableHeader.innerHTML = `
            <th>Name</th>
            <th>Contact</th>
            <th>Incident Type</th>
            <th>Disposition</th>
            <th>Location</th>
            <th>Vendor</th>
            <th>Received</th>
        `;
    }
}

// Open add lead modal
function openAddLeadModal() {
    // Create the modal if it doesn't exist
    createAddLeadModal();
    
    // Populate vendor dropdown
    populateVendorDropdown();
    
    // Add event listeners for UM coverage radio buttons
    const umCoverageYes = document.querySelector('input[name="um-coverage"][value="yes"]');
    const umCoverageNo = document.querySelector('input[name="um-coverage"][value="no"]');
    
    if (umCoverageYes) {
        umCoverageYes.addEventListener('change', function() {
            document.getElementById('um-warning').style.display = 'none';
        });
    }
    
    if (umCoverageNo) {
        umCoverageNo.addEventListener('change', function() {
            document.getElementById('um-warning').style.display = 'block';
        });
    }
    
    // Show the modal
    const modalOverlay = document.getElementById('add-lead-modal-overlay');
    modalOverlay.style.display = 'flex';
}

// Close add lead modal
function closeAddLeadModal() {
    const modalOverlay = document.getElementById('add-lead-modal-overlay');
    modalOverlay.style.display = 'none';
    
    // Reset form
    document.getElementById('add-lead-form').reset();
}

// Populate vendor dropdown in add lead form
function populateVendorDropdown() {
    const vendorSelect = document.getElementById('lead-vendor');
    
    // Clear existing options except the first one
    while (vendorSelect.options.length > 1) {
        vendorSelect.remove(1);
    }
    
    // Add fixed vendor options
    const options = [
        { value: 'IN_HOUSE', text: 'In House Marketing' },
        { value: 'VENDOR', text: 'Vendor' }
    ];
    
    options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.text;
        vendorSelect.appendChild(optionEl);
    });
}

// Handle lead submission
async function handleLeadSubmit(e) {
    e.preventDefault();
    
    // Validate form
    const form = document.getElementById('add-lead-form');
    const isValid = validateLeadForm();
    
    if (!isValid) {
        return;
    }    
    // Calculate deadline based on accident date (keep it for now for compatibility)
    let deadline60Days = 'yes'; // Default to yes since we're not using accident date anymore
    const accidentDate = new Date().toISOString().split('T')[0]; // Use today's date as a placeholder
    
    // Gather form data
    const leadData = {
        // Basic lead info
        first_name: document.getElementById('lead-first-name').value.trim(),
        last_name: document.getElementById('lead-last-name').value.trim(),
        email: document.getElementById('lead-email').value.trim(),
        phone_home: document.getElementById('lead-phone').value.trim(),
        state: document.getElementById('lead-state').value.trim(),
        zip_code: document.getElementById('lead-zip').value.trim(),
        city: document.getElementById('lead-city').value.trim(),
        vendor_code: document.getElementById('lead-vendor').value,
        notes: document.getElementById('lead-notes').value.trim(),
        
        // Qualification data
        incident_type: document.getElementById('lead-incident-type').value,
        accident_date: accidentDate, // Keep for backward compatibility
        accident_location: document.getElementById('lead-accident-location').value.trim(),
        deadline_60_days: deadline60Days,
        caller_at_fault: getRadioValue('at-fault'),
        has_attorney: getRadioValue('has-attorney'),
        was_injured: getRadioValue('injured'),
        medical_within_30_days: getRadioValue('medical-30-days'),
        at_fault_has_insurance: getRadioValue('has-insurance'),
        is_commercial_vehicle: getRadioValue('commercial-vehicle'),
        has_um_coverage: getRadioValue('um-coverage'),
        has_commercial_proof: getRadioValue('has-proof')
        
        // API key removed - now handled in headers
    };
    
    // Submit the lead
    const success = await submitLead(leadData);
    
    if (success) {
        // Close modal and refresh data
        closeAddLeadModal();
        fetchLeads();
    }
}

// Form validation
function validateLeadForm() {
    const firstName = document.getElementById('lead-first-name').value.trim();
    const lastName = document.getElementById('lead-last-name').value.trim();
    const email = document.getElementById('lead-email').value.trim();
    const phone = document.getElementById('lead-phone').value.trim();
    const vendor = document.getElementById('lead-vendor').value;
    
    let isValid = true;
    let errorMessage = '';
    
    if (!firstName) {
        errorMessage = 'First name is required';
        isValid = false;
    } else if (!lastName) {
        errorMessage = 'Last name is required';
        isValid = false;
    } else if (!email) {
        errorMessage = 'Email is required';
        isValid = false;
    } else if (!validateEmail(email)) {
        errorMessage = 'Please enter a valid email address';
        isValid = false;
    } else if (!phone) {
        errorMessage = 'Phone number is required';
        isValid = false;
    } else if (!validatePhone(phone)) {
        errorMessage = 'Please enter a valid phone number';
        isValid = false;
    } else if (!vendor) {
        errorMessage = 'Vendor code is required';
        isValid = false;
    }
    
    if (!isValid) {
        showError(errorMessage);
    } else {
        hideError();
    }
    
    return isValid;
}

// Email validation
function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Phone validation - allows various formats
function validatePhone(phone) {
    const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return re.test(String(phone));
}

// Toggle auto-refresh functionality
function toggleAutoRefresh() {
    if (autoRefreshCb.checked) {
        refreshTimer = setInterval(fetchLeads, REFRESH_INTERVAL);
    } else {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }
}

// Debounce the search to improve performance
function debounceSearch(e) {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    searchDebounceTimer = setTimeout(() => {
        handleSearch(e);
    }, 300); // 300ms debounce time
}

// Handle search input
function handleSearch(e) {
    searchTerm = e.target.value.toLowerCase().trim();
    
    // Close any expanded row before filtering
    if (expandedLeadId) {
        const expandedRow = document.getElementById(`detail-${expandedLeadId}`);
        if (expandedRow) {
            expandedRow.remove();
        }
        
        const expandedLeadRow = document.querySelector('tr.expanded');
        if (expandedLeadRow) {
            expandedLeadRow.classList.remove('expanded');
        }
    }
    
    // Close any open dropdowns
    const openDropdowns = document.querySelectorAll('.disposition-dropdown.open');
    openDropdowns.forEach(dropdown => {
        dropdown.classList.remove('open');
    });
    
    filterAndRenderLeads();
    
    // Show/hide no results message
    if (filteredLeads.length === 0 && searchTerm) {
        noDataEl.textContent = `No leads found matching "${searchTerm}"`;
        noDataEl.style.display = 'block';
        leadsTable.style.display = 'none';
    } else if (filteredLeads.length > 0) {
        noDataEl.style.display = 'none';
        leadsTable.style.display = 'table';
    }
}

// Filter and render leads based on vendor filter and search term
function filterAndRenderLeads() {
    // First filter by vendor
    const vendorCode = vendorFilter.value;
    let resultsToFilter = leads;
    
    if (vendorCode) {
        resultsToFilter = leads.filter(lead => lead.vendor_code === vendorCode);
    }
    
    // Then filter by search term if one exists
    if (searchTerm) {
        filteredLeads = resultsToFilter.filter(lead => {
            // Search in all fields, combining them for more comprehensive search
            const searchableContent = [
                `${lead.first_name} ${lead.last_name}`, // Full name
                lead.email,
                lead.phone_home,
                lead.lead_id,
                lead.zip_code,
                lead.city,
                lead.state,
                lead.notes,
                lead.disposition,
                lead.accident_date,
                lead.accident_location,
                `${lead.city} ${lead.state} ${lead.zip_code}` // Combined location
            ].filter(Boolean).join(' ').toLowerCase();
            
            return searchableContent.includes(searchTerm);
        });
    } else {
        filteredLeads = resultsToFilter;
    }
    
    // Important: Store expandedLeadId before re-rendering to maintain expanded state
    const wasExpanded = expandedLeadId;
    
    // Reset expandedLeadId to ensure no lead is automatically expanded
    expandedLeadId = null;
    
    renderLeads();
    
    // If a lead was expanded before filtering and we want to maintain that state,
    // uncomment the following code. For now, we'll keep all leads collapsed as requested.
    /*
    if (wasExpanded && filteredLeads.some(lead => lead.lead_id === wasExpanded)) {
        expandedLeadId = wasExpanded;
        const leadToExpand = filteredLeads.find(lead => lead.lead_id === wasExpanded);
        setTimeout(() => {
            if (leadToExpand) {
                addDetailRow(leadToExpand);
            }
        }, 100);
    }
    */
}

// Simple cache system for API responses
const apiCache = {
    data: null,
    timestamp: null,
    maxAge: 60000, // Cache for 1 minute
    
    set(data) {
        this.data = data;
        this.timestamp = Date.now();
    },
    
    get() {
        if (!this.data || !this.timestamp) return null;
        if (Date.now() - this.timestamp > this.maxAge) {
            this.clear();
            return null;
        }
        return this.data;
    },
    
    clear() {
        this.data = null;
        this.timestamp = null;
    }
};

// Fetch leads from API
async function fetchLeads() {
    // Check cache first
    const cachedData = apiCache.get();
    if (cachedData && !vendorFilter.value) {
        leads = cachedData;
        updateVendorOptions();
        filterAndRenderLeads();
        initializeStatsAnimation();
        initializeCharts();
        return;
    }
    
    showLoading(true);
    hideError();
    
    try {
        // Get the selected vendor code
        const vendorCode = vendorFilter.value;
        
        // Build the URL with query params if needed
        let url = API_ENDPOINT;
        if (vendorCode) {
            url += `?vendor_code=${vendorCode}`;
        }
        
        // Get JWT token from localStorage
        const token = localStorage.getItem('auth_token');
        
        // Use Cognito JWT token for authentication
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });
        
        let newLeads = [];
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token expired or invalid, redirect to login
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            
            // If API fails, show error but continue with data from localStorage
            console.error(`HTTP error ${response.status}`);
            showError('Failed to fetch leads from API. Showing cached data instead.');
            
            // Use existing data from localStorage
            const existingLeads = JSON.parse(localStorage.getItem('leads') || '[]');
            if (existingLeads.length > 0) {
                newLeads = existingLeads;
                
                // If vendor filter is applied, filter the local data
                if (vendorCode) {
                    newLeads = newLeads.filter(lead => lead.vendor_code === vendorCode);
                }
            } else {
                throw new Error(`HTTP error ${response.status}`);
            }
        } else {
            // API worked, get leads from it
            const data = await response.json();
            newLeads = data;
        }
        
        // Get existing leads from localStorage to preserve disposition and notes
        const existingLeads = JSON.parse(localStorage.getItem('leads') || '[]');
        const existingLeadsMap = new Map();
        
        // Create a map for quick lookup
        existingLeads.forEach(lead => {
            existingLeadsMap.set(lead.lead_id, {
                disposition: lead.disposition,
                notes: lead.notes,
                updated_at: lead.updated_at
            });
        });
        
        // Merge new leads with existing disposition/notes data
        leads = newLeads.map(lead => {
            const existingData = existingLeadsMap.get(lead.lead_id);
            
            if (existingData) {
                return {
                    ...lead,
                    disposition: existingData.disposition || lead.disposition || 'New',
                    notes: existingData.notes || lead.notes || '',
                    updated_at: existingData.updated_at || lead.updated_at || lead.timestamp
                };
            }
            
            return {
                ...lead,
                disposition: lead.disposition || 'New',
                notes: lead.notes || ''
            };
        });
        
        // Store updated leads in localStorage
        localStorage.setItem('leads', JSON.stringify(leads));
        
        // Cache the data if no vendor filter
        if (!vendorFilter.value) {
            apiCache.set(leads);
        }
        
        // Store all leads for export functionality
        // In a real app, this might not be efficient for large datasets
        // You might want to fetch data specifically for export instead
        if (!vendorCode) {
            allLeads = [...leads];
        }
        
        // Update vendor dropdown options
        updateVendorOptions();
        
        // After leads are fetched and processed
        filterAndRenderLeads();
        
        // Update premium UI features with new data
        initializeStatsAnimation();
        initializeCharts();
        
    } catch (error) {
        console.error('Error fetching leads:', error);
        showError('Failed to fetch leads. Please check your API endpoint and try again.');
    } finally {
        showLoading(false);
    }
}

// Open export modal
function openExportModal() {
    // Populate vendor dropdown with all available vendors
    populateExportVendorSelect();
    
    // Show the modal
    exportModalOverlay.style.display = 'flex';
}

// Close export modal
function closeExportModal() {
    exportModalOverlay.style.display = 'none';
}

// Populate the export vendor select dropdown
function populateExportVendorSelect() {
    // Clear existing options except the first one
    while (exportVendorSelect.options.length > 1) {
        exportVendorSelect.remove(1);
    }
    
    // Add fixed vendor options
    const options = [
        { value: 'IN_HOUSE', text: 'In House Marketing' },
        { value: 'VENDOR', text: 'Vendor' }
    ];
    
    options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.text;
        exportVendorSelect.appendChild(optionEl);
    });
}

// Export leads to CSV file
async function exportLeadsToCsv() {
    try {
        showLoading(true);
        
        // Get filter values
        const vendorFilter = exportVendorSelect.value;
        const startDate = exportStartDate.value ? new Date(exportStartDate.value) : null;
        const endDate = exportEndDate.value ? new Date(exportEndDate.value) : null;
        
        // Set end date to end of day
        if (endDate) {
            endDate.setHours(23, 59, 59, 999);
        }
        
        // Build export URL with query parameters
        let url = EXPORT_ENDPOINT;
        const queryParams = [];
        
        if (vendorFilter) {
            queryParams.push(`vendor_code=${encodeURIComponent(vendorFilter)}`);
        }
        
        if (startDate) {
            queryParams.push(`start_date=${encodeURIComponent(startDate.toISOString())}`);
        }
        
        if (endDate) {
            queryParams.push(`end_date=${encodeURIComponent(endDate.toISOString())}`);
        }
        
        if (queryParams.length > 0) {
            url += '?' + queryParams.join('&');
        }
        
        // Fetch the leads for export
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            mode: 'cors'
        });
        
        // Handle 401 authentication errors
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const filteredLeads = await response.json();
        
        // Check if we have leads to export
        if (filteredLeads.length === 0) {
            alert('No leads match the selected criteria.');
            return;
        }
        
        // Generate CSV content
        const csvContent = generateCsvContent(filteredLeads);
        
        // Create a download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Create file name with timestamp and filters
        let fileName = 'leads_export';
        
        if (vendorFilter) {
            fileName += `_${vendorFilter}`;
        }
        
        if (startDate) {
            fileName += `_from_${startDate.toISOString().split('T')[0]}`;
        }
        
        if (endDate) {
            fileName += `_to_${endDate.toISOString().split('T')[0]}`;
        }
        
        fileName += '.csv';
        
        // Set up download link
        link.setAttribute('href', blobUrl);
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        
        // Add to DOM, click and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Revoke the blob URL to free memory
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 100);
        
        // Close the modal
        closeExportModal();
        
    } catch (error) {
        console.error('Error exporting leads:', error);
        alert('Failed to export leads. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Generate CSV content from leads data
function generateCsvContent(leadsData) {
    if (!leadsData || leadsData.length === 0) {
        return '';
    }
    
    // Define CSV headers - customize these based on your needs
    const headers = [
        'Lead ID',
        'First Name',
        'Last Name',
        'Phone',
        'Email',
        'Zip Code',
        'State',
        'Vendor Code',
        'Timestamp'
    ];
    
    // Create header row
    let csvContent = headers.join(',') + '\n';
    
    // Add data rows
    leadsData.forEach(lead => {
        const row = [
            escapeCsvValue(lead.lead_id || ''),
            escapeCsvValue(lead.first_name || ''),
            escapeCsvValue(lead.last_name || ''),
            escapeCsvValue(lead.phone_home || ''),
            escapeCsvValue(lead.email || ''),
            escapeCsvValue(lead.zip_code || ''),
            escapeCsvValue(lead.state || ''),
            escapeCsvValue(lead.vendor_code || ''),
            escapeCsvValue(lead.timestamp || '')
        ];
        
        csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
}

// Escape CSV value to handle commas, quotes, etc.
function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    
    value = String(value);
    
    // If the value contains commas, quotes, or newlines, wrap it in quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        // Double up any quotes
        value = value.replace(/"/g, '""');
        // Wrap in quotes
        value = `"${value}"`;
    }
    
    return value;
}

// Update vendor filter options
function updateVendorOptions() {
    // Define fixed vendor options
    const fixedVendorOptions = [
        { value: 'IN_HOUSE', text: 'In House Marketing' },
        { value: 'VENDOR', text: 'Vendor' }
    ];
    
    // Save current selection
    const currentSelection = vendorFilter.value;
    
    // Clear existing options except the first one
    while (vendorFilter.options.length > 1) {
        vendorFilter.remove(1);
    }
    
    // Add fixed vendor options
    fixedVendorOptions.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.text;
        vendorFilter.appendChild(optionEl);
    });
    
    // Restore selection if it still exists in the new options
    if (currentSelection && fixedVendorOptions.some(opt => opt.value === currentSelection)) {
        vendorFilter.value = currentSelection;
    }
}

// Render leads table
function renderLeads() {
    // Clear existing rows
    leadsBody.innerHTML = '';
    
    // Show "no data" message if no leads
    if (filteredLeads.length === 0) {
        noDataEl.style.display = 'block';
        leadsTable.style.display = 'none';
        return;
    }
    
    // Hide "no data" message and show table
    noDataEl.style.display = 'none';
    leadsTable.style.display = 'table';
    
    // Sort leads by timestamp (newest first) and render
    filteredLeads
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .forEach(lead => {
            const row = document.createElement('tr');
            row.dataset.leadId = lead.lead_id;
            row.classList.add('lead-row');
            
            // Ensure no row is pre-expanded
            if (lead.lead_id !== expandedLeadId) {
                row.classList.remove('expanded');
            }
            
            row.innerHTML = `
                <td class="lead-name">
                    <div class="name-cell">
                        <span>${escapeHtml(lead.first_name)} ${escapeHtml(lead.last_name)}</span>
                        <button class="details-btn" title="Show Details">
                            <span class="details-icon">▼</span>
                        </button>
                    </div>
                </td>
                <td>
                    <div class="contact-info">
                        <div class="phone">${escapeHtml(lead.phone_home || '')}</div>
                        <div class="email">${escapeHtml(lead.email || '')}</div>
                    </div>
                </td>
                <td>${escapeHtml(lead.incident_type || '')}</td>
                <td>
                    <select class="disposition-select" data-lead-id="${lead.lead_id}">
                        <option value="New" ${(lead.disposition || 'New') === 'New' ? 'selected' : ''}>New</option>
                        <option value="Retained for Firm" ${lead.disposition === 'Retained for Firm' ? 'selected' : ''}>Retained for Firm</option>
                        <option value="Docs Sent" ${lead.disposition === 'Docs Sent' ? 'selected' : ''}>Docs Sent</option>
                        <option value="Awaiting Proof of Claim" ${lead.disposition === 'Awaiting Proof of Claim' ? 'selected' : ''}>Awaiting Proof of Claim</option>
                        <option value="Not Interested" ${lead.disposition === 'Not Interested' ? 'selected' : ''}>Not Interested</option>
                        <option value="Not Qualified Lead" ${lead.disposition === 'Not Qualified Lead' ? 'selected' : ''}>Not Qualified Lead</option>
                    </select>
                </td>
                <td>${getLocationDisplay(lead)}</td>
                <td>${escapeHtml(lead.vendor_code || '')}</td>
                <td>${formatDate(lead.timestamp, true)}</td>
            `;
            
            // Add row to table
            leadsBody.appendChild(row);
            
            // Add event listener for show details button
            const detailsBtn = row.querySelector('.details-btn');
            detailsBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent row click from firing
                toggleLeadDetails(lead);
            });
            
            // Add event listener for select dropdown
            const dispositionSelect = row.querySelector('.disposition-select');
            dispositionSelect.addEventListener('change', async function(e) {
                e.stopPropagation(); // Prevent row click
                
                const newValue = this.value;
                const leadId = this.dataset.leadId;
                
                // Find the lead in the array
                const leadToUpdate = filteredLeads.find(l => l.lead_id === leadId);
                
                try {
                    // Update without notes
                    await updateLeadDisposition(leadId, newValue, leadToUpdate.notes || '');
                    
                    // Update local data
                    leadToUpdate.disposition = newValue;
                    
                    // Update localStorage
                    updateLocalStorage();
                    
                    // Show success toast
                    showSuccessToast(`Disposition updated to "${newValue}"`);
                    
                    // Show disposition modal if needed
                    if (newValue === 'Not Qualified Lead' || newValue === 'Not Interested') {
                        showDispositionModal(leadToUpdate);
                    }
                } catch (error) {
                    console.error('Error updating disposition:', error);
                    // Revert UI to previous value
                    this.value = leadToUpdate.disposition || 'New';
                    showError('Failed to update disposition. Please try again.');
                }
            });
            
            // Make the entire row clickable
            row.addEventListener('click', function(e) {
                // Don't trigger if clicked on select or button
                if (e.target.closest('select') || e.target.closest('button')) {
                    return;
                }
                toggleLeadDetails(lead);
            });
        });
}

// Helper function to format date as YYYY-MM-DD
function formatDateYMD(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        
        if (isNaN(date)) {
            return dateString;
        }
        
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
    } catch (e) {
        return dateString;
    }
}

// Update local storage
function updateLocalStorage() {
    localStorage.setItem('leads', JSON.stringify(leads));
}

// Show error notification
function showError(message, isDuplicate = false) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    // Add special styling for duplicate errors
    if (isDuplicate) {
        errorEl.classList.add('duplicate-error');
    } else {
        errorEl.classList.remove('duplicate-error');
    }
}

// Hide error
function hideError() {
    errorEl.style.display = 'none';
    errorEl.classList.remove('duplicate-error');
}

// Handle lead submission response
function handleLeadSubmissionResponse(response, data) {
    if (response.ok) {
        return response.json().then(result => {
            return { success: true, data: result };
        });
    } else {
        // Check for duplicate lead (409 Conflict)
        if (response.status === 409) {
            return response.json().then(error => {
                return { 
                    success: false, 
                    isDuplicate: true, 
                    message: error.message || 'Duplicate lead detected'
                };
            });
        }
        
        // Handle other errors
        return response.json().then(error => {
            return { 
                success: false, 
                message: error.message || `HTTP error ${response.status}`
            };
        }).catch(() => {
            return { 
                success: false, 
                message: `HTTP error ${response.status}`
            };
        });
    }
}

// Submit lead (example for any lead submission form you might add to the dashboard)
async function submitLead(leadData) {
    showLoading(true);
    hideError();
    
    try {
        // Get JWT token from localStorage
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(leadData),
            mode: 'cors'
        });
        
        // Handle 401 authentication errors
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return false;
        }
        
        const result = await handleLeadSubmissionResponse(response, leadData);
        
        if (result.success) {
            // Successfully submitted
            alert("Lead successfully submitted!");
            // Reset form or take other success actions
            return true;
        } else {
            // Handle error
            if (result.isDuplicate) {
                showError(result.message, true);
            } else {
                showError(result.message);
            }
            return false;
        }
    } catch (error) {
        console.error('Error submitting lead:', error);
        showError('Network error while submitting lead. Please try again.');
        return false;
    } finally {
        showLoading(false);
    }
}

// Helper functions
function showLoading(show) {
    loadingEl.style.display = show ? 'block' : 'none';
}

function getLocationDisplay(lead) {
    if (lead.zip_code && lead.state) {
        return `${lead.state}, ${lead.zip_code}`;
    } else if (lead.state) {
        return lead.state;
    } else if (lead.zip_code) {
        return lead.zip_code;
    }
    return 'N/A';
}

function formatDate(dateString, includeTime = false) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        
        if (isNaN(date)) {
            return dateString;
        }
        
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.second = '2-digit';
        }
        
        return date.toLocaleDateString(undefined, options);
    } catch (e) {
        return dateString;
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
}

// Add a function to update lead disposition and notes
async function updateLeadDisposition(leadId, disposition, notes) {
    try {
        // Get JWT token from localStorage
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch(`${API_ENDPOINT}/${leadId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                disposition,
                notes
            }),
            mode: 'cors'
        });
        
        // Handle 401 authentication errors
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            throw new Error('Authentication failed');
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error ${response.status}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error updating lead disposition:', error);
        throw error;
    }
}

// Function to show the disposition update modal
function showDispositionModal(lead) {
    // Create modal on-the-fly if it doesn't exist
    if (!document.getElementById('disposition-modal-overlay')) {
        createDispositionModal();
    }
    
    const modalOverlay = document.getElementById('disposition-modal-overlay');
    const dispositionSelect = document.getElementById('lead-disposition');
    const notesTextarea = document.getElementById('lead-notes');
    const leadIdInput = document.getElementById('lead-id');
    
    // Set current values
    leadIdInput.value = lead.lead_id;
    dispositionSelect.value = lead.disposition || 'New';
    notesTextarea.value = lead.notes || '';
    
    // Show modal
    modalOverlay.style.display = 'flex';
}

// Function to create the disposition modal in the DOM
function createDispositionModal() {
    const modalHtml = `
        <div id="disposition-modal-overlay" class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Update Lead Disposition</h3>
                    <button class="modal-close" id="disposition-modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="lead-id">
                    <div class="modal-form-group">
                        <label for="lead-disposition">Disposition</label>
                        <select id="lead-disposition">
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Proposal">Proposal</option>
                            <option value="Sold">Sold</option>
                            <option value="Closed">Closed</option>
                            <option value="Lost">Lost</option>
                            <option value="Junk">Junk</option>
                        </select>
                    </div>
                    <div class="modal-form-group">
                        <label for="lead-notes">Notes</label>
                        <textarea id="lead-notes" rows="4"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="disposition-cancel">Cancel</button>
                    <button class="btn" id="disposition-save">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    
    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add event listeners
    document.getElementById('disposition-modal-close').addEventListener('click', closeDispositionModal);
    document.getElementById('disposition-cancel').addEventListener('click', closeDispositionModal);
    document.getElementById('disposition-save').addEventListener('click', saveDisposition);
}

// Function to close the disposition modal
function closeDispositionModal() {
    const modalOverlay = document.getElementById('disposition-modal-overlay');
    modalOverlay.style.display = 'none';
}

// Function to save the disposition changes
async function saveDisposition() {
    const leadId = document.getElementById('lead-id').value;
    const disposition = document.getElementById('lead-disposition').value;
    const notes = document.getElementById('lead-notes').value;
    
    try {
        showLoading(true);
        const result = await updateLeadDisposition(leadId, disposition, notes);
        
        // Update the lead in the table
        const leads = JSON.parse(localStorage.getItem('leads') || '[]');
        const leadIndex = leads.findIndex(lead => lead.lead_id === leadId);
        
        if (leadIndex !== -1) {
            leads[leadIndex].disposition = disposition;
            leads[leadIndex].notes = notes;
            leads[leadIndex].updated_at = result.lead.updated_at;
            localStorage.setItem('leads', JSON.stringify(leads));
            
            // Re-render leads
            renderLeads();
            
            // If a detail row is expanded for this lead, refresh it
            if (expandedLeadId === leadId) {
                toggleLeadDetails(leads[leadIndex]);
                toggleLeadDetails(leads[leadIndex]);
            }
        }
        
        alert('Lead disposition updated successfully');
        closeDispositionModal();
    } catch (error) {
        alert(`Error updating lead disposition: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Show a temporary success toast instead of alert
function showSuccessToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.textContent = message;
    
    // Add to DOM
    document.body.appendChild(toast);
    
    // Show the toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Hide and remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Helper function to get the value of a radio button
function getRadioValue(name) {
    const radio = document.querySelector(`input[name="${name}"]:checked`);
    return radio ? radio.value : null;
}

// Function to check deadline based on accident date
function checkDeadline(leadId) {
    const accidentDateInput = document.getElementById(`accident-date-${leadId}`);
    const deadlineWarning = document.getElementById(`deadline-warning-${leadId}`);
    const deadlineInput = document.getElementById(`deadline-60-days-${leadId}`);
    
    if (!accidentDateInput.value) {
        deadlineWarning.style.display = 'none';
        deadlineInput.value = '';
        return;
    }
    
    const accidentDate = new Date(accidentDateInput.value);
    const today = new Date();
    
    // Calculate the deadline date (2 years after accident)
    const deadlineDate = new Date(accidentDate);
    deadlineDate.setFullYear(deadlineDate.getFullYear() + 2);
    
    // Calculate days left
    const daysLeft = Math.floor((deadlineDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) {
        // Past the 2-year deadline
        deadlineWarning.style.display = 'block';
        deadlineWarning.textContent = 'Warning: This accident occurred more than 2 years ago. The statute of limitations has likely expired.';
        deadlineWarning.className = 'deadline-warning expired';
        deadlineInput.value = 'no';
    } else if (daysLeft < 60) {
        // Less than 60 days left
        deadlineWarning.style.display = 'block';
        deadlineWarning.textContent = `Warning: Only ${daysLeft} days left before the 2-year deadline expires.`;
        deadlineWarning.className = 'deadline-warning urgent';
        deadlineInput.value = 'no';
    } else {
        // More than 60 days left
        deadlineWarning.style.display = 'none';
        deadlineInput.value = 'yes';
    }
}

// Function to check insurance status and show UM coverage field when needed
function checkInsuranceStatus(leadId) {
    const hasInsuranceYes = document.querySelector(`input[name="has-insurance-${leadId}"][value="yes"]`);
    const hasInsuranceNo = document.querySelector(`input[name="has-insurance-${leadId}"][value="no"]`);
    const umCoverageSection = document.getElementById(`um-coverage-section-${leadId}`);
    const umWarning = document.getElementById(`um-warning-${leadId}`);
    const umCoverageYes = document.querySelector(`input[name="um-coverage-${leadId}"][value="yes"]`);
    const umCoverageNo = document.querySelector(`input[name="um-coverage-${leadId}"][value="no"]`);
    
    // If no insurance, show UM coverage question
    if (hasInsuranceNo && hasInsuranceNo.checked) {
        umCoverageSection.style.display = 'block';
        
        // Check if No UM coverage is selected
        if (umCoverageNo && umCoverageNo.checked) {
            umWarning.style.display = 'block';
        } else {
            umWarning.style.display = 'none';
        }
    } else {
        // If has insurance, hide UM coverage question and warning
        umCoverageSection.style.display = 'none';
        umWarning.style.display = 'none';
    }
}

// Add detail row for a lead
function addDetailRow(lead) {
    const detailRow = document.createElement('tr');
    detailRow.className = 'detail-row';
    detailRow.id = `detail-${lead.lead_id}`;
    
    const detailCell = document.createElement('td');
    detailCell.colSpan = 7;
    
    // Create two column layout for details
    const detailContent = document.createElement('div');
    detailContent.className = 'detail-content';
    
    // Left column with lead info
    const leadInfoColumn = document.createElement('div');
    leadInfoColumn.className = 'lead-info-column';
    
    // Add disposition display in detail view
    const currentDisposition = document.createElement('div');
    currentDisposition.className = 'detail-disposition-section';
    currentDisposition.innerHTML = `
        <h4>Current Disposition</h4>
        <div class="disposition-select-container">
            <select id="disposition-select-${lead.lead_id}" class="disposition-select">
                <option value="New" ${(lead.disposition || 'New') === 'New' ? 'selected' : ''}>New</option>
                <option value="Retained for Firm" ${lead.disposition === 'Retained for Firm' ? 'selected' : ''}>Retained for Firm</option>
                <option value="Docs Sent" ${lead.disposition === 'Docs Sent' ? 'selected' : ''}>Docs Sent</option>
                <option value="Awaiting Proof of Claim" ${lead.disposition === 'Awaiting Proof of Claim' ? 'selected' : ''}>Awaiting Proof of Claim</option>
                <option value="Not Interested" ${lead.disposition === 'Not Interested' ? 'selected' : ''}>Not Interested</option>
                <option value="Not Qualified Lead" ${lead.disposition === 'Not Qualified Lead' ? 'selected' : ''}>Not Qualified Lead</option>
            </select>
            <button id="save-disposition-${lead.lead_id}" class="btn btn-sm">Update</button>
        </div>
    `;
    
    leadInfoColumn.appendChild(currentDisposition);
    
    // Add basic lead details
    const leadDetails = document.createElement('div');
    leadDetails.className = 'lead-basic-details';
    
    const fields = [
        { label: 'Lead ID', value: lead.lead_id },
        { label: 'Full Name', value: `${lead.first_name || ''} ${lead.last_name || ''}` },
        { label: 'Phone', value: lead.phone_home },
        { label: 'Email', value: lead.email },
        { label: 'Location', value: getLocationDisplay(lead) },
        { label: 'Vendor', value: lead.vendor_code },
        { label: 'Received', value: formatDate(lead.timestamp, true) }
    ];
    
    fields.forEach(field => {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';
        
        detailItem.innerHTML = `
            <div class="detail-label">${field.label}</div>
            <div class="detail-value">${escapeHtml(field.value || '')}</div>
        `;
        
        leadDetails.appendChild(detailItem);
    });
    
    leadInfoColumn.appendChild(leadDetails);
    
    // Create lead notes container
    const notesContainer = document.createElement('div');
    notesContainer.className = 'lead-detail-item lead-notes-container';
    notesContainer.innerHTML = `
        <h4>Notes</h4>
        <textarea id="lead-notes-${lead.lead_id}" class="lead-notes" rows="4">${escapeHtml(lead.notes || '')}</textarea>
        <button id="save-notes-${lead.lead_id}" class="btn btn-sm">Save Notes</button>
    `;
    leadInfoColumn.appendChild(notesContainer);
    
    // Create DocuSign retainer section
    const retainerContainer = document.createElement('div');
    retainerContainer.className = 'lead-detail-item retainer-container';
    retainerContainer.innerHTML = `
        <h4>Retainer Agreement</h4>
        <div class="docusign-option">
            <label class="checkbox-container">
                <input type="checkbox" id="send-retainer-checkbox-${lead.lead_id}">
                <span class="checkbox-label">Send retainer agreement</span>
            </label>
            <button id="submit-retainer-${lead.lead_id}" class="btn btn-sm btn-docusign">Submit Retainer</button>
        </div>
    `;
    leadInfoColumn.appendChild(retainerContainer);
    
    // Add Lead Event History section
    const historyContainer = document.createElement('div');
    historyContainer.className = 'lead-detail-item lead-history-container';
    
    // Create history header
    historyContainer.innerHTML = `<h4>Lead Event History</h4>`;
    
    // Create history table
    const historyTable = document.createElement('table');
    historyTable.className = 'history-table';
    historyTable.innerHTML = `
        <thead>
            <tr>
                <th>Date/Time</th>
                <th>Action</th>
                <th>Details</th>
            </tr>
        </thead>
        <tbody id="history-body-${lead.lead_id}">
        </tbody>
    `;
    
    // Add history entries if available
    const historyBody = historyTable.querySelector(`#history-body-${lead.lead_id}`);
    if (lead.update_history && lead.update_history.length > 0) {
        // Sort history with newest first
        const sortedHistory = [...lead.update_history].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        sortedHistory.forEach(entry => {
            const historyRow = document.createElement('tr');
            
            // Format the details based on action type
            let details = '';
            if (entry.action === 'created') {
                details = 'Lead created';
            } else if (entry.action === 'updated') {
                if (entry.disposition) {
                    details += `Disposition: ${escapeHtml(entry.disposition)}<br>`;
                }
                if (entry.checklist_updated) {
                    details += 'Qualification data updated<br>';
                }
                if (entry.notes) {
                    const truncatedNotes = entry.notes.length > 50 
                        ? entry.notes.substring(0, 50) + '...' 
                        : entry.notes;
                    details += `Notes: ${escapeHtml(truncatedNotes)}`;
                }
            } else if (entry.action === 'docusign_status_update') {
                details = `DocuSign Status: ${escapeHtml(entry.status || 'Unknown')}`;
            }
            
            historyRow.innerHTML = `
                <td>${formatDate(entry.timestamp, true)}</td>
                <td>${escapeHtml(entry.action)}</td>
                <td>${details}</td>
            `;
            
            historyBody.appendChild(historyRow);
        });
    } else {
        // No history available
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="3">No event history available</td>`;
        historyBody.appendChild(emptyRow);
    }
    
    historyContainer.appendChild(historyTable);
    leadInfoColumn.appendChild(historyContainer);
    
    // Right column with qualification checklist
    const qualificationColumn = document.createElement('div');
    qualificationColumn.className = 'qualification-column';
    
    qualificationColumn.innerHTML = `
        <h4>Qualification Checklist</h4>
        <div class="qualification-form" id="qualification-form-${lead.lead_id}">
            <div class="qualification-item">
                <label>Where did the accident happen?</label>
                <input type="text" id="accident-location-${lead.lead_id}" value="${escapeHtml(lead.accident_location || '')}">
            </div>
            
            <div class="qualification-item">
                <label>Incident Type</label>
                <select id="incident-type-${lead.lead_id}">
                    <option value="">Select Type</option>
                    <option value="PFAS" ${lead.incident_type === 'PFAS' ? 'selected' : ''}>PFAS</option>
                    <option value="VGA" ${lead.incident_type === 'VGA' ? 'selected' : ''}>VGA</option>
                    <option value="MVA" ${lead.incident_type === 'MVA' ? 'selected' : ''}>MVA</option>
                    <option value="CMVA" ${lead.incident_type === 'CMVA' ? 'selected' : ''}>CMVA</option>
                    <option value="PI" ${lead.incident_type === 'PI' ? 'selected' : ''}>PI</option>
                </select>
            </div>
            
            <div class="qualification-item" style="display: none;">
                <input type="hidden" id="accident-date-${lead.lead_id}" value="${lead.accident_date || ''}">
                <input type="hidden" id="deadline-60-days-${lead.lead_id}" value="${lead.deadline_60_days || ''}">
            </div>
            
            <div class="qualification-item">
                <label>Was the caller at fault?</label>
                <div class="yes-no-options">
                    <label class="yes-no-label">
                        <input type="radio" name="at-fault-${lead.lead_id}" value="yes" ${lead.caller_at_fault === 'yes' ? 'checked' : ''}>
                        Yes
                    </label>
                    <label class="yes-no-label">
                        <input type="radio" name="at-fault-${lead.lead_id}" value="no" ${lead.caller_at_fault === 'no' ? 'checked' : ''}>
                        No
                    </label>
                </div>
            </div>
            
            <div class="qualification-item">
                <label>Does the caller already have an attorney?</label>
                <div class="yes-no-options">
                    <label class="yes-no-label">
                        <input type="radio" name="has-attorney-${lead.lead_id}" value="yes" ${lead.has_attorney === 'yes' ? 'checked' : ''}>
                        Yes
                    </label>
                    <label class="yes-no-label">
                        <input type="radio" name="has-attorney-${lead.lead_id}" value="no" ${lead.has_attorney === 'no' ? 'checked' : ''}>
                        No
                    </label>
                </div>
            </div>
            
            <div class="qualification-item">
                <label>Was the caller injured?</label>
                <div class="yes-no-options">
                    <label class="yes-no-label">
                        <input type="radio" name="injured-${lead.lead_id}" value="yes" ${lead.was_injured === 'yes' ? 'checked' : ''}>
                        Yes
                    </label>
                    <label class="yes-no-label">
                        <input type="radio" name="injured-${lead.lead_id}" value="no" ${lead.was_injured === 'no' ? 'checked' : ''}>
                        No
                    </label>
                </div>
            </div>
            
            <div class="qualification-item">
                <label>Did they see a medical professional within 30 days?</label>
                <div class="yes-no-options">
                    <label class="yes-no-label">
                        <input type="radio" name="medical-30-days-${lead.lead_id}" value="yes" ${lead.medical_within_30_days === 'yes' ? 'checked' : ''}>
                        Yes
                    </label>
                    <label class="yes-no-label">
                        <input type="radio" name="medical-30-days-${lead.lead_id}" value="no" ${lead.medical_within_30_days === 'no' ? 'checked' : ''}>
                        No
                    </label>
                </div>
            </div>
            
            <div class="qualification-item">
                <label>Did the at-fault party have insurance?</label>
                <div class="yes-no-options">
                    <label class="yes-no-label">
                        <input type="radio" name="has-insurance-${lead.lead_id}" value="yes" ${lead.at_fault_has_insurance === 'yes' ? 'checked' : ''} onchange="checkInsuranceStatus('${lead.lead_id}')">
                        Yes
                    </label>
                    <label class="yes-no-label">
                        <input type="radio" name="has-insurance-${lead.lead_id}" value="no" ${lead.at_fault_has_insurance === 'no' ? 'checked' : ''} onchange="checkInsuranceStatus('${lead.lead_id}')">
                        No
                    </label>
                </div>
            </div>
            
            <div class="qualification-item">
                <label>Was it a commercial/government vehicle (and caller knows the entity)?</label>
                <div class="yes-no-options">
                    <label class="yes-no-label">
                        <input type="radio" name="commercial-vehicle-${lead.lead_id}" value="yes" ${lead.is_commercial_vehicle === 'yes' ? 'checked' : ''}>
                        Yes
                    </label>
                    <label class="yes-no-label">
                        <input type="radio" name="commercial-vehicle-${lead.lead_id}" value="no" ${lead.is_commercial_vehicle === 'no' ? 'checked' : ''}>
                        No
                    </label>
                </div>
            </div>
            
            <div id="um-coverage-section-${lead.lead_id}" class="qualification-item" style="${lead.at_fault_has_insurance === 'no' ? 'display:block' : 'display:none'}">
                <label>If no insurance or hit-and-run: Does the caller have UM coverage?</label>
                <div class="yes-no-options">
                    <label class="yes-no-label">
                        <input type="radio" name="um-coverage-${lead.lead_id}" value="yes" ${lead.has_um_coverage === 'yes' ? 'checked' : ''} onchange="checkInsuranceStatus('${lead.lead_id}')">
                        Yes
                    </label>
                    <label class="yes-no-label">
                        <input type="radio" name="um-coverage-${lead.lead_id}" value="no" ${lead.has_um_coverage === 'no' ? 'checked' : ''} onchange="checkInsuranceStatus('${lead.lead_id}')">
                        No
                    </label>
                </div>
                <div id="um-warning-${lead.lead_id}" class="insurance-warning" style="display:none">
                    Warning: Caller has no insurance and no UM coverage. Recommend disqualifying this lead.
                </div>
            </div>
            
            <div class="qualification-item">
                <label>Does the caller have proof that the other vehicle was commercial/government?</label>
                <div class="yes-no-options">
                    <label class="yes-no-label">
                        <input type="radio" name="has-proof-${lead.lead_id}" value="yes" ${lead.has_commercial_proof === 'yes' ? 'checked' : ''}>
                        Yes
                    </label>
                    <label class="yes-no-label">
                        <input type="radio" name="has-proof-${lead.lead_id}" value="no" ${lead.has_commercial_proof === 'no' ? 'checked' : ''}>
                        No
                    </label>
                </div>
            </div>
            
            <button id="save-qualification-${lead.lead_id}" class="btn save-qualification-btn">Save Qualification Data</button>
        </div>
    `;
    
    // Add both columns to the detail content
    detailContent.appendChild(leadInfoColumn);
    detailContent.appendChild(qualificationColumn);
    
    detailCell.appendChild(detailContent);
    detailRow.appendChild(detailCell);
    
    // Find the row after which to insert the detail row
    const leadRow = document.querySelector(`tr[data-lead-id="${lead.lead_id}"]`);
    if (leadRow) {
        leadRow.parentNode.insertBefore(detailRow, leadRow.nextSibling);
    }
    
    // Add event listeners for save buttons
    setTimeout(() => {
        // Disposition update handler
        const saveDispositionBtn = document.getElementById(`save-disposition-${lead.lead_id}`);
        if (saveDispositionBtn) {
            saveDispositionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newDisposition = document.getElementById(`disposition-select-${lead.lead_id}`).value;
                updateLeadData(lead.lead_id, { disposition: newDisposition });
            });
        }
        
        // Notes update handler
        const saveNotesBtn = document.getElementById(`save-notes-${lead.lead_id}`);
        if (saveNotesBtn) {
            saveNotesBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const notes = document.getElementById(`lead-notes-${lead.lead_id}`).value;
                
                // Update the lead notes
                await updateLeadData(lead.lead_id, { notes });
            });
        }
        
        // Add event listener for the Submit Retainer button
        const submitRetainerBtn = document.getElementById(`submit-retainer-${lead.lead_id}`);
        if (submitRetainerBtn) {
            submitRetainerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showSendRetainerModal(lead);
            });
        }
        
        // Qualification data update handler
        const saveQualificationBtn = document.getElementById(`save-qualification-${lead.lead_id}`);
        if (saveQualificationBtn) {
            saveQualificationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Gather all qualification data
                const qualificationData = {
                    accident_location: document.getElementById(`accident-location-${lead.lead_id}`).value,
                    incident_type: document.getElementById(`incident-type-${lead.lead_id}`).value,
                    accident_date: document.getElementById(`accident-date-${lead.lead_id}`).value,
                    deadline_60_days: document.getElementById(`deadline-60-days-${lead.lead_id}`).value,
                    caller_at_fault: getRadioValue(`at-fault-${lead.lead_id}`),
                    has_attorney: getRadioValue(`has-attorney-${lead.lead_id}`),
                    was_injured: getRadioValue(`injured-${lead.lead_id}`),
                    medical_within_30_days: getRadioValue(`medical-30-days-${lead.lead_id}`),
                    at_fault_has_insurance: getRadioValue(`has-insurance-${lead.lead_id}`),
                    is_commercial_vehicle: getRadioValue(`commercial-vehicle-${lead.lead_id}`),
                    has_um_coverage: getRadioValue(`um-coverage-${lead.lead_id}`),
                    has_commercial_proof: getRadioValue(`has-proof-${lead.lead_id}`)
                };
                
                updateLeadData(lead.lead_id, qualificationData);
            });
        }
        
        // Check deadline based on accident date when the form is loaded
        if (lead.accident_date) {
            checkDeadline(lead.lead_id);
        }
        
        // Check insurance status when form is loaded
        checkInsuranceStatus(lead.lead_id);
    }, 0);

    // Add Send Retainer button
    const sendRetainerButton = document.createElement('button');
    sendRetainerButton.className = 'btn btn-secondary btn-sm';
    sendRetainerButton.textContent = 'Send Retainer';
    sendRetainerButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent toggling the lead row
        showSendRetainerModal(lead);
    });
    
    // Find the update disposition button to place our new button next to it
    const dispositionButton = detailRow.querySelector('.btn-update-disposition');
    if (dispositionButton && dispositionButton.parentNode) {
        // Insert button after disposition button
        dispositionButton.parentNode.insertBefore(sendRetainerButton, dispositionButton.nextSibling);
        
        // Add a space between buttons
        dispositionButton.parentNode.insertBefore(document.createTextNode(' '), sendRetainerButton);
    }
    
    // Add DocuSign status if available
    if (lead.docusign_info) {
        const dsInfo = lead.docusign_info;
        const dsStatusCell = document.createElement('div');
        dsStatusCell.className = 'lead-detail-item';
        
        let dsStatusHtml = `
            <h4>Retainer Status</h4>
            <p><strong>Status:</strong> ${dsInfo.status || 'Unknown'}</p>
        `;
        
        if (dsInfo.sentAt) {
            dsStatusHtml += `<p><strong>Sent:</strong> ${formatDate(dsInfo.sentAt, true)}</p>`;
        }
        
        if (dsInfo.deliveredAt) {
            dsStatusHtml += `<p><strong>Delivered:</strong> ${formatDate(dsInfo.deliveredAt, true)}</p>`;
        }
        
        if (dsInfo.viewedAt) {
            dsStatusHtml += `<p><strong>Viewed:</strong> ${formatDate(dsInfo.viewedAt, true)}</p>`;
        }
        
        if (dsInfo.completedAt) {
            dsStatusHtml += `<p><strong>Completed:</strong> ${formatDate(dsInfo.completedAt, true)}</p>`;
        }
        
        if (dsInfo.declinedAt) {
            dsStatusHtml += `<p><strong>Declined:</strong> ${formatDate(dsInfo.declinedAt, true)}</p>`;
        }
        
        dsStatusHtml += `
            <button id="resend-retainer-${lead.lead_id}" class="btn btn-secondary btn-sm">Resend Retainer</button>
        `;
        
        dsStatusCell.innerHTML = dsStatusHtml;
        detailContent.appendChild(dsStatusCell);
        
        // Add event listener for the resend button
        setTimeout(() => {
            const resendBtn = document.getElementById(`resend-retainer-${lead.lead_id}`);
            if (resendBtn) {
                resendBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showSendRetainerModal(lead, true);
                });
            }
        }, 0);
    }
}

// Function to update lead data via PATCH endpoint
async function updateLeadData(leadId, data) {
    try {
        showLoading(true);
        
        // Add the timestamp for tracking when updates occur
        const updateData = {
            ...data,
            updated_at: new Date().toISOString()
        };
        
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch(`${API_ENDPOINT}/${leadId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData),
            mode: 'cors'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token expired or invalid, redirect to login
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error ${response.status}`);
        }
        
        const result = await response.json();
        
        // Update the lead in local state
        const leadIndex = leads.findIndex(lead => lead.lead_id === leadId);
        
        if (leadIndex !== -1) {
            // Update the lead with the new data
            leads[leadIndex] = {
                ...leads[leadIndex],
                ...updateData
            };
            
            // Update localStorage
            updateLocalStorage();
            
            // Re-render leads to show updated data
            filterAndRenderLeads();
            
            // If this lead is expanded, make sure it stays expanded
            if (expandedLeadId === leadId) {
                setTimeout(() => {
                    const leadRow = document.querySelector(`tr[data-lead-id="${leadId}"]`);
                    if (leadRow) {
                        addDetailRow(leads[leadIndex]);
                    }
                }, 0);
            }
            
            // Show success message
            showSuccessToast('Lead data updated successfully');
        }
    } catch (error) {
        console.error('Error updating lead data:', error);
        showError(`Error updating lead data: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Toggle lead details visibility
function toggleLeadDetails(lead) {
    const detailRow = document.getElementById(`detail-${lead.lead_id}`);
    
    if (detailRow) {
        // Detail row exists, so hide it
        detailRow.remove();
        expandedLeadId = null;
    } else {
        // No detail row, create one
        expandedLeadId = lead.lead_id;
        addDetailRow(lead);
    }
}

// The existing filter function now delegates to filterAndRenderLeads
function filterLeads() {
    filterAndRenderLeads();
}

// Toggle UM coverage section based on insurance selection in add lead form
function toggleUmCoverageSection() {
    const hasInsuranceYes = document.querySelector('input[name="has-insurance"][value="yes"]');
    const hasInsuranceNo = document.querySelector('input[name="has-insurance"][value="no"]');
    const umCoverageSection = document.getElementById('um-coverage-section');
    const umWarning = document.getElementById('um-warning');
    
    // If no insurance, show UM coverage question
    if (hasInsuranceNo && hasInsuranceNo.checked) {
        umCoverageSection.style.display = 'block';
        
        // Check if No UM coverage is selected
        const umCoverageNo = document.querySelector('input[name="um-coverage"][value="no"]');
        if (umCoverageNo && umCoverageNo.checked) {
            umWarning.style.display = 'block';
        } else {
            umWarning.style.display = 'none';
        }
    } else {
        // If has insurance, hide UM coverage question and warning
        umCoverageSection.style.display = 'none';
        umWarning.style.display = 'none';
    }
}

// Check deadline based on accident date in add lead form
function checkAddLeadDeadline() {
    const accidentDateInput = document.getElementById('lead-accident-date');
    const deadlineWarning = document.getElementById('lead-deadline-warning');
    
    if (!accidentDateInput.value) {
        deadlineWarning.style.display = 'none';
        return;
    }
    
    const accidentDate = new Date(accidentDateInput.value);
    const today = new Date();
    
    // Calculate the deadline date (2 years after accident)
    const deadlineDate = new Date(accidentDate);
    deadlineDate.setFullYear(deadlineDate.getFullYear() + 2);
    
    // Calculate days left
    const daysLeft = Math.floor((deadlineDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) {
        // Past the 2-year deadline
        deadlineWarning.style.display = 'block';
        deadlineWarning.textContent = 'Warning: This accident occurred more than 2 years ago. The statute of limitations has likely expired.';
        deadlineWarning.className = 'deadline-warning expired';
    } else if (daysLeft < 60) {
        // Less than 60 days left
        deadlineWarning.style.display = 'block';
        deadlineWarning.textContent = `Warning: Only ${daysLeft} days left before the 2-year deadline expires.`;
        deadlineWarning.className = 'deadline-warning urgent';
    } else {
        // More than 60 days left
        deadlineWarning.style.display = 'none';
    }
}

// Add function to show the send retainer modal
function showSendRetainerModal(lead, isResend = false) {
    // Create the modal if it doesn't exist
    if (!document.getElementById('send-retainer-modal-overlay')) {
        createSendRetainerModal();
    }
    
    // Set the lead ID in a data attribute
    const modal = document.getElementById('send-retainer-modal');
    modal.dataset.leadId = lead.lead_id;
    modal.dataset.isResend = isResend ? 'true' : 'false';
    
    // Set recipient info in modal
    document.getElementById('retainer-recipient').textContent = `${lead.first_name} ${lead.last_name} (${lead.email})`;
    
    // Update title and button text for resend cases
    if (isResend) {
        document.querySelector('#send-retainer-modal .modal-title').textContent = 'Resend Retainer Agreement';
        document.getElementById('send-retainer-submit').textContent = 'Resend Agreement';
    } else {
        document.querySelector('#send-retainer-modal .modal-title').textContent = 'Send Retainer Agreement';
        document.getElementById('send-retainer-submit').textContent = 'Send Agreement';
    }
    
    // Show the modal
    document.getElementById('send-retainer-modal-overlay').style.display = 'flex';
}

// Create the send retainer modal
function createSendRetainerModal() {
    const modalHtml = `
        <div id="send-retainer-modal-overlay" class="modal-overlay">
            <div id="send-retainer-modal" class="modal" style="width: 600px; max-width: 95%;">
                <div class="modal-header">
                    <h3 class="modal-title">Send Retainer Agreement</h3>
                    <button class="modal-close" id="send-retainer-modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>You are about to send a retainer agreement to:</p>
                    <p><strong id="retainer-recipient"></strong></p>
                    
                    <div class="modal-form-group">
                        <label for="retainer-subject">Email Subject:</label>
                        <input type="text" id="retainer-subject" value="Please sign your retainer agreement">
                    </div>
                    
                    <div class="modal-form-group">
                        <label for="retainer-message">Email Message:</label>
                        <textarea id="retainer-message" rows="3">Please review and sign the attached retainer agreement at your earliest convenience.</textarea>
                    </div>
                    
                    <div id="retainer-status-message" class="status-message" style="display: none;"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="send-retainer-cancel">Cancel</button>
                    <button class="btn" id="send-retainer-submit">Send Agreement</button>
                </div>
            </div>
        </div>
    `;
    
    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add event listeners
    document.getElementById('send-retainer-modal-close').addEventListener('click', closeSendRetainerModal);
    document.getElementById('send-retainer-cancel').addEventListener('click', closeSendRetainerModal);
    document.getElementById('send-retainer-submit').addEventListener('click', sendRetainerAgreement);
}

// Close send retainer modal
function closeSendRetainerModal() {
    const modalOverlay = document.getElementById('send-retainer-modal-overlay');
    modalOverlay.style.display = 'none';
    
    // Reset form and status message
    document.getElementById('retainer-status-message').style.display = 'none';
    document.getElementById('retainer-status-message').className = 'status-message';
    document.getElementById('send-retainer-submit').disabled = false;
}

// Send retainer agreement
async function sendRetainerAgreement() {
    const modal = document.getElementById('send-retainer-modal');
    const leadId = modal.dataset.leadId;
    const isResend = modal.dataset.isResend === 'true';
    const subject = document.getElementById('retainer-subject').value;
    const message = document.getElementById('retainer-message').value;
    
    // Disable submit button
    document.getElementById('send-retainer-submit').disabled = true;
    
    // Show loading message
    const statusElement = document.getElementById('retainer-status-message');
    statusElement.textContent = isResend ? 'Resending agreement...' : 'Sending agreement...';
    statusElement.className = 'status-message info';
    statusElement.style.display = 'block';
    
    try {
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch(`${API_ENDPOINT}/${leadId}/send-retainer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                emailSubject: subject,
                emailBlurb: message,
                sendNow: true,
                force: isResend // Set force to true when resending
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token expired or invalid, redirect to login
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            
            // Show error message
            statusElement.textContent = `Error: ${data.message || 'Failed to send agreement'}`;
            statusElement.className = 'status-message error';
            // Re-enable button
            document.getElementById('send-retainer-submit').disabled = false;
            return;
        }
        
        // Show success message
        statusElement.textContent = isResend ? 'Agreement resent successfully!' : 'Agreement sent successfully!';
        statusElement.className = 'status-message success';
        
        // Close modal after delay
        setTimeout(() => {
            closeSendRetainerModal();
            // Refresh leads to show updated status
            fetchLeads();
        }, 2000);
    } catch (error) {
        console.error('Error sending retainer agreement:', error);
        statusElement.textContent = 'Error: Could not connect to server';
        statusElement.className = 'status-message error';
        // Re-enable button
        document.getElementById('send-retainer-submit').disabled = false;
    }
}

// Initialize animated statistics
function initializeStatsAnimation() {
    // Get leads data for calculations
    const totalLeads = leads.length;
    const convertedLeads = leads.filter(lead => 
        lead.disposition === 'Retained for Firm' || 
        lead.disposition === 'Docs Sent'
    ).length;
    const activeLeads = leads.filter(lead => 
        lead.disposition === 'New' || 
        lead.disposition === 'Awaiting Proof of Claim'
    ).length;
    
    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    
    // Calculate potential revenue (example: $5000 per converted lead)
    const revenuePotential = activeLeads * 5000;
    
    // Animate the numbers using CountUp.js
    if (typeof CountUp !== 'undefined') {
        // Total Leads Counter
        const totalLeadsCounter = new CountUp('total-leads-count', totalLeads, {
            duration: 2.5,
            useEasing: true,
            useGrouping: true,
            suffix: ''
        });
        totalLeadsCounter.start();
        
        // Conversion Rate Counter
        const conversionCounter = new CountUp('conversion-rate', conversionRate, {
            duration: 2.5,
            useEasing: true,
            suffix: ''
        });
        conversionCounter.start();
        
        // Active Leads Counter
        const activeLeadsCounter = new CountUp('active-leads-count', activeLeads, {
            duration: 2.5,
            useEasing: true,
            useGrouping: true
        });
        activeLeadsCounter.start();
        
        // Revenue Potential Counter
        const revenueCounter = new CountUp('revenue-potential', revenuePotential, {
            duration: 3,
            useEasing: true,
            useGrouping: true,
            separator: ',',
            decimal: '.',
            prefix: ''
        });
        revenueCounter.start();
    }
}

// Initialize Charts with Chart.js
function initializeCharts() {
    if (typeof Chart === 'undefined') return;
    
    // Configure Chart.js defaults
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif';
    Chart.defaults.color = '#4a5568';
    
    // Lead Flow Chart (Line Chart)
    const leadFlowCtx = document.getElementById('leadFlowChart');
    if (leadFlowCtx) {
        // Generate sample data for last 7 days
        const last7Days = [...Array(7)].map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        });
        
        const leadFlowData = last7Days.map(() => Math.floor(Math.random() * 20) + 10);
        
        new Chart(leadFlowCtx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'New Leads',
                    data: leadFlowData,
                    borderColor: '#4299e1',
                    backgroundColor: 'rgba(66, 153, 225, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#4299e1',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            borderDash: [5, 5]
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    // Status Distribution Chart (Doughnut)
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
        // Count leads by status
        const statusCounts = {};
        leads.forEach(lead => {
            const status = lead.disposition || 'New';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: [
                        '#4299e1',
                        '#48bb78',
                        '#f6ad55',
                        '#fc8181',
                        '#9f7aea',
                        '#68d391'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
    
    // Vendor Performance Chart (Bar)
    const vendorCtx = document.getElementById('vendorChart');
    if (vendorCtx) {
        // Count leads by vendor
        const vendorCounts = {};
        leads.forEach(lead => {
            const vendor = lead.vendor_code || 'Unknown';
            vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
        });
        
        new Chart(vendorCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(vendorCounts),
                datasets: [{
                    label: 'Total Leads',
                    data: Object.values(vendorCounts),
                    backgroundColor: '#667eea',
                    borderRadius: 8,
                    barThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            borderDash: [5, 5]
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
} 