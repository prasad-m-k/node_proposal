/**
 * Utility Functions Module
 * Common utility functions used across the application
 */

// DOM manipulation utilities
export const DomUtils = {
    /**
     * Safely get an element by ID
     */
    getElementById(id) {
        return document.getElementById(id);
    },

    /**
     * Safely query selector
     */
    querySelector(selector) {
        return document.querySelector(selector);
    },

    /**
     * Safely query selector all
     */
    querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    },

    /**
     * Add event listener with error handling
     */
    addEventListener(element, event, handler, options = {}) {
        if (!element) return;

        const wrappedHandler = (e) => {
            try {
                handler(e);
            } catch (error) {
                console.error('Event handler error:', error);
            }
        };

        element.addEventListener(event, wrappedHandler, options);
        return () => element.removeEventListener(event, wrappedHandler, options);
    },

    /**
     * Create element with attributes and content
     */
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);

        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });

        if (content) {
            if (typeof content === 'string') {
                element.textContent = content;
            } else if (content instanceof HTMLElement) {
                element.appendChild(content);
            }
        }

        return element;
    },

    /**
     * Show/hide element
     */
    toggle(element, show) {
        if (!element) return;

        if (show === undefined) {
            element.hidden = !element.hidden;
        } else {
            element.hidden = !show;
        }
    },

    /**
     * Add/remove CSS classes
     */
    toggleClass(element, className, add) {
        if (!element) return;

        if (add === undefined) {
            element.classList.toggle(className);
        } else if (add) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }
};

// Theme management utilities
export const ThemeUtils = {
    applyTheme(theme) {
        const normalizedTheme = theme === 'dark' ? 'dark' : 'bright';
        const themeStylesheet = document.getElementById('themeStylesheet');

        if (themeStylesheet) {
            themeStylesheet.href = normalizedTheme === 'dark' ? '/dark.css' : '/bright.css';
        }

        if (document.body) {
            document.body.classList.remove('theme-bright', 'theme-dark');
            document.body.classList.add(`theme-${normalizedTheme}`);
        }

        try {
            localStorage.setItem('preferredTheme', normalizedTheme);
        } catch (error) {
            console.error('Theme persistence error:', error);
        }
    },

    getCurrentTheme() {
        try {
            return localStorage.getItem('preferredTheme') || 'bright';
        } catch (error) {
            console.error('Theme retrieval error:', error);
            return 'bright';
        }
    },

    initializeTheme() {
        const savedTheme = this.getCurrentTheme();
        this.applyTheme(savedTheme);
        return savedTheme;
    }
};

// Local storage utilities
export const StorageUtils = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    },

    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    },

    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }
};

// Validation utilities
export const ValidationUtils = {
    isEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    isNotEmpty(value) {
        return value && value.trim().length > 0;
    },

    isValidLength(value, min = 0, max = Infinity) {
        const length = value ? value.length : 0;
        return length >= min && length <= max;
    },

    isNumber(value) {
        return !isNaN(value) && !isNaN(parseFloat(value));
    },

    isInteger(value) {
        return Number.isInteger(Number(value));
    },

    isPositive(value) {
        return this.isNumber(value) && Number(value) > 0;
    }
};

// String utilities
export const StringUtils = {
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    capitalizeWords(str) {
        if (!str) return '';
        return str.split(' ').map(word => this.capitalize(word)).join(' ');
    },

    formatStatus(status) {
        if (!status) return 'Pending';
        return status
            .replace(/_/g, ' ')
            .replace(/\b\w/g, match => match.toUpperCase());
    },

    truncate(str, length = 50, suffix = '...') {
        if (!str || str.length <= length) return str;
        return str.substring(0, length) + suffix;
    },

    slug(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Date utilities
export const DateUtils = {
    formatDate(date, options = {}) {
        if (!date) return '';

        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };

        return d.toLocaleDateString(undefined, { ...defaultOptions, ...options });
    },

    formatDateTime(date, options = {}) {
        if (!date) return '';

        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        return d.toLocaleString(undefined, { ...defaultOptions, ...options });
    },

    timeAgo(date) {
        if (!date) return '';

        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;

        return this.formatDate(date);
    }
};

// File utilities
export const FileUtils = {
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    getFileExtension(filename) {
        if (!filename) return '';
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    },

    isImageFile(filename) {
        if (!filename) return false;
        const ext = this.getFileExtension(filename).toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
    },

    isDocumentFile(filename) {
        if (!filename) return false;
        const ext = this.getFileExtension(filename).toLowerCase();
        return ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext);
    },

    downloadBlob(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
};

// Async utilities
export const AsyncUtils = {
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    timeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Operation timed out')), ms)
            )
        ]);
    },

    retry(fn, attempts = 3, delay = 1000) {
        return new Promise((resolve, reject) => {
            const attempt = (n) => {
                fn().then(resolve).catch((error) => {
                    if (n === 1) {
                        reject(error);
                    } else {
                        setTimeout(() => attempt(n - 1), delay);
                    }
                });
            };
            attempt(attempts);
        });
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, wait) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, wait);
            }
        };
    }
};

// Event emitter utility
export class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);

        // Return unsubscribe function
        return () => this.off(event, listener);
    }

    off(event, listener) {
        if (!this.events[event]) return;

        this.events[event] = this.events[event].filter(l => l !== listener);
        if (this.events[event].length === 0) {
            delete this.events[event];
        }
    }

    emit(event, ...args) {
        if (!this.events[event]) return;

        this.events[event].forEach(listener => {
            try {
                listener(...args);
            } catch (error) {
                console.error('Event listener error:', error);
            }
        });
    }

    once(event, listener) {
        const onceListener = (...args) => {
            this.off(event, onceListener);
            listener(...args);
        };
        return this.on(event, onceListener);
    }
}

// Logger utility
export class Logger {
    constructor(prefix = '', level = 'info') {
        this.prefix = prefix;
        this.level = level;
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    log(level, message, ...args) {
        if (this.levels[level] <= this.levels[this.level]) {
            const timestamp = new Date().toISOString();
            const prefixStr = this.prefix ? `[${this.prefix}]` : '';
            console[level](`${timestamp} ${prefixStr} ${message}`, ...args);
        }
    }

    error(message, ...args) {
        this.log('error', message, ...args);
    }

    warn(message, ...args) {
        this.log('warn', message, ...args);
    }

    info(message, ...args) {
        this.log('info', message, ...args);
    }

    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
}