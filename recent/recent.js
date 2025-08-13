const container = document.getElementById('recent-list-container');
const refreshBtn = document.getElementById('refresh-btn');
const daysBackInput = document.getElementById('days-back');

// Cache for job skills by job_id to avoid repeated full fetches
const state = {
	skillsByJob: null, // Map of job_id -> array of skills
};

async function fetchRecent(daysBack = 5, limit = 200) {
	const endpoint = `http://127.0.0.1:8000/jobs_recent?days_back=${encodeURIComponent(daysBack)}&limit=${encodeURIComponent(limit)}`;
	const response = await fetch(endpoint, { method: 'GET' });
	if (!response.ok) {
		let msg = `API Error: ${response.status}`;
		try { const d = await response.json(); if (d?.detail) msg = d.detail; } catch {}
		throw new Error(msg);
	}
	return response.json();
}

async function fetchAllSkillsOnce() {
	if (state.skillsByJob) return state.skillsByJob;
	const endpoint = 'http://127.0.0.1:8000/job_skills';
	const response = await fetch(endpoint, { method: 'GET' });
	if (!response.ok) {
		let msg = `API Error: ${response.status}`;
		try { const d = await response.json(); if (d?.detail) msg = d.detail; } catch {}
		throw new Error(msg);
	}
	const rows = await response.json();
	const map = new Map();
	for (const r of rows) {
		const list = map.get(r.job_id) || [];
		list.push(r);
		map.set(r.job_id, list);
	}
	state.skillsByJob = map;
	return map;
}

function mapSkillsToSections(skills) {
	const required = [];
	const additional = [];
	const evaluated = [];
	for (const i of skills || []) {
		const entry = {
			requirement: i.job_skills_atomic_string,
			match: i.job_skills_match,
			match_reason: i.job_skills_match_reasoning,
		};
		if (i.job_skills_type === 'required_qualification') required.push(entry);
		else if (i.job_skills_type === 'additional_qualification') additional.push(entry);
		else if (i.job_skills_type === 'evaluated_qualification') evaluated.push({ requirement: i.job_skills_atomic_string });
	}
	return { required, additional, evaluated };
}

function createQualificationTable(title, qualificationsArray, headers) {
	if (!qualificationsArray || qualificationsArray.length === 0) return '';
	let matchFraction = '';
	if (headers.length === 3) {
		const totalMatches = qualificationsArray.filter(item => item.match === 1).length;
		const totalRequirements = qualificationsArray.length;
		matchFraction = `<span class="match-fraction">(${totalMatches}/${totalRequirements})</span>`;
	}
	let tableHtml = `<h4><span>${title}</span>${matchFraction}</h4>`;
	tableHtml += `<table class="qualification-table" data-columns="${headers.length}"><thead><tr>`;
	headers.forEach(header => { tableHtml += `<th>${header}</th>`; });
	tableHtml += '</tr></thead><tbody>';
	for (const item of qualificationsArray) {
		tableHtml += '<tr>';
		if (headers.includes('Requirement')) tableHtml += `<td>${item.requirement || 'N/A'}</td>`;
		if (headers.includes('Match')) {
			const isMatch = item.match === 1;
			const matchText = isMatch ? 'Yes' : 'No';
			const matchClass = isMatch ? 'match-yes' : 'match-no';
			tableHtml += `<td class="${matchClass}">${matchText}</td>`;
		}
		if (headers.includes('Match Reason')) tableHtml += `<td>${item.match_reason || 'N/A'}</td>`;
		tableHtml += '</tr>';
	}
	tableHtml += '</tbody></table>';
	return tableHtml;
}

async function regenerateAssessment(jobId) {
	const endpoint = 'http://127.0.0.1:8000/regenerate_job_assessment';
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ job_id: jobId })
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `API Error: ${response.status}`);
	}
	return response.json();
}

function renderJobDetails(data) {
	if (!data) return '<p>No details available.</p>';
	const uniquePrefix = `details-${data.job_id}-${Date.now()}`;
	const descriptionId = `${uniquePrefix}-desc`;
	const copyBtnId = `${uniquePrefix}-copy-btn`;
	const regenBtnId = `${uniquePrefix}-regen-btn`;
	const regenStatusId = `${uniquePrefix}-regen-status`;
	let description = data.job_description || 'Not found.';
	const keyMappings = { job_company: 'Company', job_title: 'Title', job_salary: 'Salary', job_location: 'Location', job_url_direct: 'Direct Link' };
	let detailsHtml = '<table class="job-data-table">';
	for (const key in keyMappings) {
		if (Object.prototype.hasOwnProperty.call(data, key)) {
			let value = data[key] || 'N/A';
			if (key === 'job_url_direct' && value !== 'N/A') {
				const jobId = data.job_id || '';
				const linkText = `View Job ${jobId}`.trim();
				value = `<a href="${value}" target="_blank">${linkText}</a>`;
			}
			detailsHtml += `<tr><td>${keyMappings[key]}</td><td>${value}</td></tr>`;
		}
	}
	detailsHtml += '</table>';
	detailsHtml += `
		<div class="details-action-bar">
			<button id="${regenBtnId}" class="regen-button" title="Regenerate assessment">Regenerate Assessment</button>
			<span id="${regenStatusId}" class="regen-status"></span>
		</div>
		<h4 class="description-header"><span>Description</span><button id="${copyBtnId}" class="copy-button" title="Copy description">Copy</button></h4>
		<pre id="${descriptionId}" class="job-description">${description}</pre>
	`;
	const threeColumn = ['Requirement', 'Match', 'Match Reason'];
	const oneColumn = ['Requirement'];
	detailsHtml += createQualificationTable('Required Qualifications', data.required_qualifications, threeColumn);
	detailsHtml += createQualificationTable('Additional Qualifications', data.additional_qualifications, threeColumn);
	detailsHtml += createQualificationTable('Evaluated Qualifications', data.evaluated_qualifications, oneColumn);
	return { html: detailsHtml, ids: { copyBtnId, descriptionId, regenBtnId, regenStatusId } };
}

function renderJobRow(job) {
	const row = document.createElement('div');
	row.className = 'job-row';
	const title = job.job_title || 'Untitled';
	const company = job.job_company || '';
	const location = job.job_location || 'N/A';
	const displayTitle = company ? `${title} at ${company}` : title;

	const lastAssessedAt = job.last_assessed_at ? new Date(job.last_assessed_at * 1000) : null;
	const lastAssessedText = lastAssessedAt ? lastAssessedAt.toLocaleString() : '';

	row.innerHTML = `
		<div class="row-header">
			<div class="row-title">${displayTitle}</div>
			<div class="row-location">${location}</div>
		</div>
		<div class="row-submeta">${lastAssessedText}</div>
		<div class="details-container"></div>
	`;

	const header = row.querySelector('.row-header');
	const detailsContainer = row.querySelector('.details-container');

	header.addEventListener('click', async () => {
		const isVisible = detailsContainer.style.display === 'block';
		if (isVisible) {
			detailsContainer.style.display = 'none';
			row.classList.remove('expanded');
		} else {
			if (!detailsContainer.innerHTML) {
				// Load skills once, then map for this job
				const skillsMap = await fetchAllSkillsOnce();
				const jobSkills = skillsMap.get(job.job_id) || [];
				const sections = mapSkillsToSections(jobSkills);
				const data = {
					job_id: job.job_id,
					job_title: job.job_title,
					job_company: job.job_company,
					job_location: job.job_location,
					job_salary: job.job_salary,
					job_url: job.job_url,
					job_url_direct: job.job_url_direct,
					job_description: job.job_description,
					required_qualifications: sections.required,
					additional_qualifications: sections.additional,
					evaluated_qualifications: sections.evaluated,
				};
				const rendered = renderJobDetails(data);
				detailsContainer.innerHTML = rendered.html;

				const copyBtn = document.getElementById(rendered.ids.copyBtnId);
				const descriptionEl = document.getElementById(rendered.ids.descriptionId);
				const regenBtn = document.getElementById(rendered.ids.regenBtnId);
				const regenStatusEl = document.getElementById(rendered.ids.regenStatusId);

				if (copyBtn && descriptionEl) {
					copyBtn.addEventListener('click', (e) => {
						e.stopPropagation();
						navigator.clipboard.writeText(descriptionEl.textContent).then(() => {
							copyBtn.textContent = 'Copied!';
							setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
						}).catch(err => {
							console.error('Failed to copy text: ', err);
							copyBtn.textContent = 'Error!';
						});
					});
				}

				if (regenBtn) {
					regenBtn.addEventListener('click', async (e) => {
						e.stopPropagation();
						if (regenBtn.disabled) return;
						const originalText = regenBtn.textContent;
						regenBtn.disabled = true;
						regenBtn.textContent = 'Regenerating...';
						regenStatusEl.textContent = '';
						try {
							const resp = await regenerateAssessment(job.job_id);
							if (resp.status === 'success' && resp.data) {
								// Update skills cache for this job
								const newSkillsMap = await fetchAllSkillsOnce();
								// We don't have a single-job endpoint, so refresh full list after regen
								state.skillsByJob = null;
								await fetchAllSkillsOnce();
								const updatedSkills = state.skillsByJob.get(job.job_id) || [];
								const updatedSections = mapSkillsToSections(updatedSkills);
								const updatedData = {
									...resp.data,
									required_qualifications: updatedSections.required,
									additional_qualifications: updatedSections.additional,
									evaluated_qualifications: updatedSections.evaluated,
								};
								const rerendered = renderJobDetails(updatedData);
								detailsContainer.innerHTML = rerendered.html;
								// rebind buttons
								const copyBtn2 = document.getElementById(rerendered.ids.copyBtnId);
								const descriptionEl2 = document.getElementById(rerendered.ids.descriptionId);
								const regenBtn2 = document.getElementById(rerendered.ids.regenBtnId);
								const regenStatusEl2 = document.getElementById(rerendered.ids.regenStatusId);
								if (copyBtn2 && descriptionEl2) {
									copyBtn2.addEventListener('click', (evt) => {
										evt.stopPropagation();
										navigator.clipboard.writeText(descriptionEl2.textContent).then(() => {
											copyBtn2.textContent = 'Copied!';
											setTimeout(() => { copyBtn2.textContent = 'Copy'; }, 2000);
										});
									});
								}
								if (regenBtn2) {
									regenBtn2.addEventListener('click', (evt) => evt.stopPropagation());
								}
							} else {
								regenStatusEl.textContent = 'Error';
							}
						} catch (err) {
							console.error('Regenerate failed', err);
							regenStatusEl.textContent = 'Error';
						} finally {
							regenBtn.disabled = false;
							regenBtn.textContent = originalText;
							setTimeout(() => { regenStatusEl.textContent = ''; }, 4000);
						}
					});
				}
			}
			detailsContainer.style.display = 'block';
			row.classList.add('expanded');
		}
	});

	return row;
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
			container.appendChild(renderJobRow(job));
		}
	} catch (err) {
		console.error('Failed to load recent jobs', err);
		container.innerHTML = `<p class="empty">${err.message || 'Failed to load recent jobs.'}</p>`;
	}
}

refreshBtn.addEventListener('click', loadRecent);
document.addEventListener('DOMContentLoaded', loadRecent);
