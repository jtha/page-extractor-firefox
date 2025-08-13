const container = document.getElementById('recent-list-container');
const refreshBtn = document.getElementById('refresh-btn');
const daysBackInput = document.getElementById('days-back');

async function fetchRecent(daysBack = 5, limit = 200) {
	const endpoint = `http://127.0.0.1:8000/jobs_recent?days_back=${encodeURIComponent(daysBack)}&limit=${encodeURIComponent(limit)}`;
	const response = await fetch(endpoint, { method: 'GET' });
	if (!response.ok) {
		// Try to parse error body, else generic
		let msg = `API Error: ${response.status}`;
		try { const d = await response.json(); if (d?.detail) msg = d.detail; } catch {}
		throw new Error(msg);
	}
	return response.json();
}

function renderJobCard(job) {
	const title = job.job_title || 'Untitled';
	const company = job.job_company || '';
	const displayTitle = company ? `${title} at ${company}` : title;

	const lastAssessedAt = job.last_assessed_at ? new Date(job.last_assessed_at * 1000) : null;
	const lastAssessedText = lastAssessedAt ? lastAssessedAt.toLocaleString() : 'Unknown';

	const div = document.createElement('div');
	div.className = 'job-item';
	div.innerHTML = `
		<div class="job-header">
			<div class="job-title">${displayTitle}</div>
			<div class="job-meta">Last assessed: ${lastAssessedText}</div>
		</div>
		${job.job_url_direct ? `<div class="job-url"><a href="${job.job_url_direct}" target="_blank">Open posting</a></div>` : ''}
		<table class="job-data-table">
			<tr><td>Location</td><td>${job.job_location || 'N/A'}</td></tr>
			<tr><td>Salary</td><td>${job.job_salary || 'N/A'}</td></tr>
			<tr><td>Job ID</td><td>${job.job_id}</td></tr>
		</table>
	`;
	return div;
}

async function loadRecent() {
	const daysBack = Math.max(1, parseInt(daysBackInput.value || '5', 10));
	try {
		container.innerHTML = '<p class="empty">Loading…</p>';
		const data = await fetchRecent(daysBack, 200);
		if (!Array.isArray(data) || data.length === 0) {
			container.innerHTML = '<p class="empty">No recent assessed jobs found.</p>';
			return;
		}
		container.innerHTML = '';
		for (const job of data) {
			container.appendChild(renderJobCard(job));
		}
	} catch (err) {
		console.error('Failed to load recent jobs', err);
		container.innerHTML = `<p class="empty">${err.message || 'Failed to load recent jobs.'}</p>`;
	}
}

refreshBtn.addEventListener('click', loadRecent);
document.addEventListener('DOMContentLoaded', loadRecent);
