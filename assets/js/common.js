// ----------------
// App namespace
// ----------------
const app = {
	ui: {},
	data: {},
	i18n: {},
	resultMap: {
		known: {
			navbar: 'primary',
			alert:  'primary',
			icon:   'wr-icon-circle-question',
			text:   'result-known',
			btn:    false
		},
		pirated: {
			navbar: 'danger',
			alert:  'danger',
			icon:   'wr-icon-circle-xmark',
			text:   'result-pirated',
			btn:    true
		},
		safe: {
			navbar: 'success',
			alert:  'success',
			icon:   'wr-icon-circle-check',
			text:   'result-safe',
			btn:    false
		}
	},
};

// ----------------
// Helper utilities
// ----------------

// URL query parameter helpers
function getQueryParam(name) {
	const params = new URLSearchParams(window.location.search);
	const query = params.get(name);

	if (!query) return null;

	return query.trim().replace(/[<>"]/g, '').slice(0, 128);
}

function updateQueryParam(value) {
	const url = new URL(window.location);
	const cleanQuery = value ? value.trim().slice(0, 128) : '';

	if (cleanQuery) {
		url.searchParams.set('q', cleanQuery);
	} else {
		url.searchParams.delete('q');
	}

	window.history.replaceState({}, '', url);
}

// Normalize and resolve domain match against site lists
function normalizeDomain(value) {
	try {
		return new URL(value.includes('://') ? value : 'https://' + value)
			.hostname
			.toLowerCase()
			.replace(/^www\d?\./, '');
	} catch(e) {
		return null;
	}
}

function resolveDomain(domain) {
	if (!domain) return null;

	const { sites } = app.data;

	const isMatch = (list) =>
		list.some(d => domain === d || domain.endsWith('.' + d));

	const result =
		isMatch(sites.safe) ? 'safe' :
		isMatch(sites.pirated) ? 'pirated' :
		isMatch(sites.known) ? 'known' :
		null;

	return result ? { domain: domain, result } : null;
}

// Reset search state before processing (navbar + alert + button)
function resetSearchState() {
	app.ui.alert.innerHTML = '';

	app.ui.searchBtn.setAttribute('disabled', 'disabled');

	app.ui.navbar.classList.remove('bg-success', 'bg-danger');
	app.ui.navbar.classList.add('bg-primary');

	app.ui.footerLinks.forEach((el) => {
		el.classList.remove('btn-link-success', 'btn-link-danger');
		el.classList.add('btn-link-primary');
	});

	app.ui.footerIcon.classList.remove('text-success', 'text-danger');
	app.ui.footerIcon.classList.add('text-primary');
}

// Update search state (URL, UI, suggestions, result)
function updateSearchState() {
	const value = app.ui.searchInput.value.trim();
	const isFocused = document.activeElement === app.ui.searchInput;

	updateQueryParam(value || null);
	resetSearchState();
	toggleSuggestions(isFocused && !value);

	if (!value) return;

	const domain = normalizeDomain(value);
	if (!domain) return;

	app.ui.searchBtn.removeAttribute('disabled');

	// Resolve domain and render result if matched
	const resolved = resolveDomain(domain);
	if (!resolved) return;

	renderResult(resolved.result);
}

// Render search result (navbar + alert)
function renderResult(type) {
	const config = app.resultMap[type];

	if (!config) return;

	app.ui.navbar.classList.remove('bg-success', 'bg-danger', 'bg-primary');
	app.ui.navbar.classList.add(`bg-${config.navbar}`);

	app.ui.footerLinks.forEach((el) => {
		el.classList.remove('btn-link-success', 'btn-link-danger', 'btn-link-primary');
		el.classList.add(`btn-link-${config.alert}`);
	});

	app.ui.footerIcon.classList.remove('text-success', 'text-danger', 'text-primary');
	app.ui.footerIcon.classList.add(`text-${config.alert}`);

	app.ui.searchBtn.setAttribute('disabled', 'disabled');

	app.ui.alert.classList.remove('alert-success', 'alert-danger', 'alert-primary');
	app.ui.alert.classList.add(`alert-${config.alert}`);

	let html =
		`<i class="wr-icon ${config.icon}"></i> ` +
		app.i18n.translations[config.text];

	if (config.btn) {
		html += ` <button class="btn btn-link p-0 ms-1" data-bs-toggle="modal" data-bs-target="#modal-warez">
			${app.i18n.translations['result-pirated-link']}
		</button>`;
	}

	app.ui.alert.innerHTML = html;
}

// Suggestions list helpers
function toggleSuggestions(isVisible) {
	app.ui.suggestions.classList.toggle('show', isVisible);
	app.ui.suggestions.toggleAttribute('inert', !isVisible);

	app.ui.searchInput.setAttribute('aria-expanded', isVisible.toString());
}

function renderSuggestions() {
	app.ui.suggestions.innerHTML = `
		<li class="dropdown-header" data-i18n="search-suggestions"></li>
		${app.data.sites.suggestions.map(item => `
			<li>
				<button class="dropdown-item" type="button" role="option">${item}</button>
			</li>
		`).join('')}
	`;
}

// Apply theme and update toggle icon
function setTheme(theme) {
	document.documentElement.setAttribute('data-bs-theme', theme);
	localStorage.setItem('theme', theme);

	const toggleTo = theme === 'dark' ? 'light' : 'dark';
	app.ui.themeToggle.innerHTML = `<i class="wr-icon wr-icon-theme-${toggleTo}"></i>`;
}

// Load and apply language
async function updateLanguage(lang) {
	try {
		const response = await fetch(`locales/${lang}.json`);
		const translations = await response.json();

		app.i18n.translations = translations;

		// Update page metadata
		document.title = translations['title'];

		document
			.querySelector('meta[name="description"]')
			.setAttribute('content', translations['meta-description']);

		document
			.querySelector('meta[property="og:description"]')
			.setAttribute('content', translations['meta-description']);

		const dynamicValues = {
			totalPirated: app.data.piratedSitesCount,
			totalSafe:    app.data.safeSitesCount,
			dataUpdated:  app.data.sites?.dataUpdated ?? '',
			appVersion:   app.data.sites?.appVersion ?? '',
			year:         new Date().getFullYear()
		};

		// Apply translations with dynamic values
		document.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.dataset.i18n;
			if (translations[key]) {
				el.innerHTML = translations[key].replace(/%(\w+)%/g, (_, k) => dynamicValues[k] ?? '');
			}
		});

		document.documentElement.lang = lang;

		// Highlight active language button
		['en', 'kk', 'ru', 'uk'].forEach(l => {
			const btn = document.getElementById(`lang-${l}`);

			if (btn) {
				if (l === lang) {
					btn.classList.remove('btn-outline-light');
					btn.classList.add('btn-light');
				} else {
					btn.classList.remove('btn-light');
					btn.classList.add('btn-outline-light');
				}
			}
		});

		// Save preferred language
		localStorage.setItem('preferredLanguage', lang);

		// Update result after language change
		if (app.ui.alert.hasChildNodes()) {
			updateSearchState();
		}
	} catch (error) {
		console.error('Error loading language: ', error);
	} finally {
		document.body.classList.remove('is-loading');
	}
}

// ----------------
// Initialization functions
// ----------------

// Initialize UI elements by selectors
function initUI() {
	app.ui.navbar                  = document.getElementById('navbar');
	app.ui.themeToggle             = document.getElementById('theme-toggle');
	app.ui.searchContainer         = document.getElementById('search-container');
	app.ui.searchInput             = document.getElementById('url');
	app.ui.clearBtn                = document.getElementById('clear-button');
	app.ui.searchBtn               = document.getElementById('search-button');
	app.ui.alert                   = document.getElementById('alert-message');
	app.ui.suggestions             = document.getElementById('suggestions');
	app.ui.footerLinks             = document.querySelectorAll('footer .btn');
	app.ui.footerIcon              = document.getElementById('footer-icon');
	app.ui.reportModal             = document.getElementById('modal-report');
}

// Load site lists
async function loadSites() {
	const res = await fetch('data/sites.json');
	app.data.sites = await res.json();

	['safe', 'pirated', 'known'].forEach(key => {
		app.data.sites[key] = app.data.sites[key].map(d => new URL('http://' + d).hostname);
	});

	app.data.piratedSitesCount = app.data.sites.pirated.length;
	app.data.safeSitesCount = app.data.sites.safe.length;
	app.data.isReady = true;
}

// Initialize language on page load
async function initLanguage() {
	// Detect user locale if no preferred language is saved
	let savedLang = localStorage.getItem('preferredLanguage');

	if (!savedLang) {
		const userLocale = navigator.language || navigator.userLanguage;

		if (userLocale.startsWith('uk')) {
			savedLang = 'uk';
		} else if (userLocale.startsWith('en')) {
			savedLang = 'en';
		} else if (userLocale.startsWith('kk')) {
			savedLang = 'kk';
		} else {
			savedLang = 'ru';
		}
	}

	updateLanguage(savedLang);
}

// Bind events
function initEvents() {
	// Toggle theme
	app.ui.themeToggle.addEventListener('click', () => {
		const current = document.documentElement.getAttribute('data-bs-theme') || 'light';
		setTheme(current === 'dark' ? 'light' : 'dark');
	});

	// Handle user actions with search input
	app.ui.searchInput.addEventListener('input', updateSearchState);
	app.ui.searchInput.addEventListener('focus', updateSearchState);

	app.ui.clearBtn.addEventListener('click', () => {
		app.ui.searchInput.value = '';
		app.ui.searchInput.focus();

		updateSearchState();
	});

	// Handle suggestion interactions
	let suggestionPointer = null;

	app.ui.suggestions.addEventListener('pointerdown', (e) => {
		const item = e.target.closest('.dropdown-item');
		if (!item) return;

		suggestionPointer = {
			item,
			y: e.clientY
		};
	});

	app.ui.suggestions.addEventListener('pointerup', (e) => {
		if (!suggestionPointer) return;

		if (Math.abs(e.clientY - suggestionPointer.y) <= 10) {
			app.ui.searchInput.value = suggestionPointer.item.textContent.trim();

			updateSearchState();
		}

		suggestionPointer = null;
	});

	document.addEventListener('click', (e) => {
		if (!app.ui.searchContainer.contains(e.target)) {
			toggleSuggestions(false);
		}
	});

	// Listen for Enter key press to show modal
	document.addEventListener('keydown', (event) => {
		if (
			event.key === 'Enter'
			&& document.activeElement === app.ui.searchInput
			&& !app.ui.searchBtn.disabled
		) {
			const modal = new bootstrap.Modal(document.getElementById('modal-report'));
			modal.show();
		}
	});

	// Toggle Report modal alert visibility by source
	app.ui.reportModal.addEventListener('show.bs.modal', event => {
		const source = event.relatedTarget?.getAttribute('data-bs-report-source');
		const alert = app.ui.reportModal.querySelector('.modal-report-alert');

		alert.classList.toggle('d-none', source === 'footer');
	})
}

// ----------------
// App startup
// ----------------

// Initialize app
async function initApp() {
	app.data.sites = null;
	app.data.isReady = false;
	app.i18n.translations = {};

	initUI();
	initEvents();

	// Init theme
	const savedTheme = localStorage.getItem('theme');

	const initialTheme =
		savedTheme ||
		(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

	setTheme(initialTheme);

	// Load site lists and language translations
	await loadSites();
	await initLanguage();
	
	renderSuggestions();

	// Restore search input from URL
	const value = getQueryParam('q');
	if (value) app.ui.searchInput.value = value;

	// Sync UI with current search value
	updateSearchState();
}

document.addEventListener('DOMContentLoaded', initApp);