// Configuration
const API_URL = 'http://localhost:8000';

// State
let currentSession = null;
let eventSource = null;
let startTime = null;
let durationInterval = null;

// Theme Management
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

themeToggle.addEventListener('click', () => {
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
    lucide.createIcons();
});

// Load theme from localStorage
if (localStorage.getItem('theme') === 'light') {
    html.classList.remove('dark');
}

// Tab Management
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        
        // Update button states
        tabButtons.forEach(btn => {
            btn.classList.remove('active', 'border-blue-600', 'text-blue-600', 'dark:border-blue-400', 'dark:text-blue-400');
            btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'dark:hover:text-gray-300');
        });
        
        button.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        button.classList.add('active', 'border-blue-600', 'text-blue-600', 'dark:border-blue-400', 'dark:text-blue-400');
        
        // Update content
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// Initialize first tab as active
tabButtons[0].classList.add('border-blue-600', 'text-blue-600', 'dark:border-blue-400', 'dark:text-blue-400');
tabButtons[0].classList.remove('border-transparent', 'text-gray-500');

// File Upload Handling
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
let uploadedFile = null;

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('border-blue-500', 'dark:border-blue-400');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('border-blue-500', 'dark:border-blue-400');
    });
});

dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.py')) {
            uploadedFile = file;
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('filePreview').classList.remove('hidden');
            
            // Read file content
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('codeEditor').value = e.target.result;
            };
            reader.readAsText(file);
        } else {
            showNotification('Please upload a Python (.py) file', 'error');
        }
    }
}

function clearFile() {
    uploadedFile = null;
    fileInput.value = '';
    document.getElementById('filePreview').classList.add('hidden');
}

// Sample Code
const sampleBuggyCode = `# Sample: E-commerce Order Processing Bug
# This code has multiple bugs for demonstration

class ShoppingCart:
    def __init__(self):
        self.items = []
    
    def add_item(self, item):
        """Add item to cart."""
        self.items.append(item)
    
    def get_item(self, index):
        """Get item by index - BUG: No bounds checking"""
        return self.items[index]
    
    def calculate_discount(self, discount_percent):
        """Calculate discounted total - BUG: Division by zero possible"""
        total = sum(item['price'] for item in self.items)
        
        # BUG: When discount is 100%, this divides by zero
        discount_multiplier = 100 / (100 - discount_percent)
        
        return total / discount_multiplier

def process_order(cart, user_data):
    """Process order - BUG: No null checking"""
    # BUG: user_data can be None
    user_name = user_data['name']
    
    # BUG: Accessing index that may not exist
    first_item = cart.get_item(0)
    
    print(f"Processing order for {user_name}")
    print(f"First item: {first_item}")
    
    # BUG: 100% discount causes division by zero
    discounted = cart.calculate_discount(100)
    print(f"Total: {discounted}")

# Test code that triggers the bug
cart = ShoppingCart()
# Empty cart - will cause index error
user_data = None  # Will cause attribute error

process_order(cart, user_data)
`;

function loadSampleCode() {
    document.getElementById('codeEditor').value = sampleBuggyCode;
    showNotification('Sample buggy code loaded', 'success');
}

// Analysis Functions
async function startAnalysis() {
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    
    let requestData = {
        language: 'python',
        auto_run: document.getElementById('autoRun')?.checked ?? true
    };
    
    // Collect data based on active tab
    if (activeTab === 'github') {
        const repoUrl = document.getElementById('repoUrl').value.trim();
        const errorLog = document.getElementById('githubErrorLog').value.trim();
        
        if (!repoUrl) {
            showNotification('Please enter a repository URL', 'error');
            return;
        }
        
        requestData.repo_url = repoUrl;
        requestData.error_log = errorLog;
    } else if (activeTab === 'file' || activeTab === 'code') {
        const codeContent = document.getElementById('codeEditor').value.trim();
        
        if (!codeContent) {
            showNotification('Please provide code to analyze', 'error');
            return;
        }
        
        requestData.code_content = codeContent;
    }
    
    // Reset UI
    resetAnalysis();
    
    // Show status section
    document.getElementById('statusSection').classList.remove('hidden');
    document.getElementById('resultsSection').classList.add('hidden');
    
    // Disable analyze button
    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Analyzing...</span>';
    lucide.createIcons();
    
    try {
        // Start analysis
        const endpoint = activeTab === 'github' ? '/api/debug/start' : '/api/debug/file';
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        currentSession = data.session_id;
        
        // Update UI
        document.getElementById('sessionId').textContent = currentSession.substring(0, 8);
        updateStatus('running', 'Running');
        
        // Start duration counter
        startTime = Date.now();
        durationInterval = setInterval(updateDuration, 1000);
        
        // Connect to SSE
        connectSSE(data.sse_url);
        
        // Add initial event
        addEvent('info', 'Analysis started', 'Session initialized');
        
    } catch (error) {
        console.error('Error starting analysis:', error);
        showNotification(`Failed to start analysis: ${error.message}`, 'error');
        resetAnalyzeButton();
    }
}

function connectSSE(sseUrl) {
    eventSource = new EventSource(`${API_URL}${sseUrl}`);
    
    eventSource.onopen = () => {
        addEvent('success', 'Connected', 'SSE connection established');
    };
    
    eventSource.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data);
        addEvent('info', 'Progress', `${data.phase}: ${data.message}`);
        document.getElementById('currentPhase').textContent = data.phase;
        updateProgressBar(data.phase);
    });
    
    eventSource.addEventListener('complete', async (e) => {
        const data = JSON.parse(e.data);
        addEvent('success', 'Complete', 'Analysis finished successfully');
        updateStatus('completed', 'Completed');
        updateProgressBar('complete');
        
        // Fetch results
        await fetchResults();
        
        // Close connection
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        
        // Stop duration counter
        if (durationInterval) {
            clearInterval(durationInterval);
        }
        
        resetAnalyzeButton();
    });
    
    eventSource.addEventListener('error', (e) => {
        addEvent('error', 'Error', 'Connection error occurred');
        updateStatus('error', 'Error');
        resetAnalyzeButton();
        
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        
        if (durationInterval) {
            clearInterval(durationInterval);
        }
    });
    
    eventSource.onerror = (error) => {
        console.error('SSE error:', error);
    };
}

async function fetchResults() {
    try {
        const response = await fetch(`${API_URL}/api/debug/status/${currentSession}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch results');
        }
        
        const data = await response.json();
        displayResults(data);
        
    } catch (error) {
        console.error('Error fetching results:', error);
        showNotification('Failed to fetch results', 'error');
    }
}

function displayResults(data) {
    document.getElementById('resultsSection').classList.remove('hidden');
    
    const result = data.result;
    
    if (!result) {
        showNotification('No results available', 'warning');
        return;
    }
    
    // Show execution error or success
    if (result.execution_error) {
        document.getElementById('errorCard').classList.remove('hidden');
        document.getElementById('errorContent').textContent = result.execution_error;
    } else if (result.output) {
        document.getElementById('successCard').classList.remove('hidden');
        document.getElementById('successContent').textContent = result.output;
    }
    
    // Show analysis if available
    if (result.analysis) {
        document.getElementById('analysisCards').classList.remove('hidden');
        
        if (result.analysis.root_cause) {
            document.getElementById('rootCauseContent').innerHTML = formatAnalysis(result.analysis.root_cause);
        }
        
        if (result.analysis.fix) {
            document.getElementById('fixContent').innerHTML = formatAnalysis(result.analysis.fix);
        }
        
        if (result.analysis.code_analysis) {
            document.getElementById('codeAnalysisContent').innerHTML = formatAnalysis(result.analysis.code_analysis);
        }
        
        if (result.analysis.tests) {
            document.getElementById('testsContent').innerHTML = formatAnalysis(result.analysis.tests);
        }
    }
}

function formatAnalysis(text) {
    // Try to parse as JSON first
    try {
        const obj = JSON.parse(text);
        return `<pre class="text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">${JSON.stringify(obj, null, 2)}</pre>`;
    } catch {
        // Return as formatted text
        return `<div class="prose dark:prose-invert max-w-none">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// UI Helper Functions
function updateStatus(status, label) {
    const badge = document.getElementById('statusBadge');
    badge.className = 'px-3 py-1 text-xs font-medium rounded-full';
    
    switch (status) {
        case 'running':
            badge.classList.add('bg-blue-100', 'text-blue-800', 'dark:bg-blue-900', 'dark:text-blue-300');
            break;
        case 'completed':
            badge.classList.add('bg-green-100', 'text-green-800', 'dark:bg-green-900', 'dark:text-green-300');
            break;
        case 'error':
            badge.classList.add('bg-red-100', 'text-red-800', 'dark:bg-red-900', 'dark:text-red-300');
            break;
    }
    
    badge.textContent = label;
}

function updateProgressBar(phase) {
    const progressBar = document.getElementById('progressBar');
    const phases = {
        'initialization': 10,
        'planning': 20,
        'analysis': 40,
        'reproduction': 50,
        'root_cause': 70,
        'fix': 85,
        'test': 95,
        'complete': 100
    };
    
    const progress = phases[phase] || 0;
    progressBar.style.width = `${progress}%`;
}

function updateDuration() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('duration').textContent = `${elapsed}s`;
}

function addEvent(type, title, message) {
    const eventLog = document.getElementById('eventLog');
    const eventItem = document.createElement('div');
    eventItem.className = `event-item ${type} p-3 bg-gray-50 dark:bg-gray-700 rounded-lg`;
    
    const time = new Date().toLocaleTimeString();
    
    eventItem.innerHTML = `
        <div class="flex items-start space-x-3">
            <div class="flex-shrink-0 mt-0.5">
                ${getEventIcon(type)}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white">${title}</p>
                <p class="text-xs text-gray-600 dark:text-gray-400">${message}</p>
                <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">${time}</p>
            </div>
        </div>
    `;
    
    eventLog.appendChild(eventItem);
    eventLog.scrollTop = eventLog.scrollHeight;
}

function getEventIcon(type) {
    const icons = {
        'info': '<i data-lucide="info" class="w-4 h-4 text-blue-600"></i>',
        'success': '<i data-lucide="check-circle" class="w-4 h-4 text-green-600"></i>',
        'warning': '<i data-lucide="alert-triangle" class="w-4 h-4 text-yellow-600"></i>',
        'error': '<i data-lucide="x-circle" class="w-4 h-4 text-red-600"></i>'
    };
    
    return icons[type] || icons['info'];
}

function clearEvents() {
    document.getElementById('eventLog').innerHTML = '';
}

function resetAnalyzeButton() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<i data-lucide="play" class="w-4 h-4"></i><span>Analyze Code</span>';
    lucide.createIcons();
}

function resetAnalysis() {
    clearEvents();
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('sessionId').textContent = '-';
    document.getElementById('duration').textContent = '0s';
    document.getElementById('currentPhase').textContent = '-';
    
    // Hide result cards
    document.getElementById('errorCard').classList.add('hidden');
    document.getElementById('successCard').classList.add('hidden');
    document.getElementById('analysisCards').classList.add('hidden');
}

function showNotification(message, type = 'info') {
    // Simple notification (you can enhance this with a proper notification library)
    const colors = {
        'info': 'bg-blue-500',
        'success': 'bg-green-500',
        'warning': 'bg-yellow-500',
        'error': 'bg-red-500'
    };
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform translate-x-0`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
});