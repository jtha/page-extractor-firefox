const jobListContainer = document.getElementById('job-list-container');
const clearHistoryBtn = document.getElementById('clear-history-btn');

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

// Add helper to call regenerate endpoint
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

// --- UPDATED FUNCTION ---
// Renders the detailed HTML, now including the copy & regenerate buttons.
function renderJobDetails(data) {
  if (!data) return '<p>No details available.</p>';

  const uniquePrefix = `details-${data.task_id}-${data.job_id || 'no-job-id'}`;
  const descriptionId = `${uniquePrefix}-desc`;
  const copyBtnId = `${uniquePrefix}-copy-btn`;
  const regenBtnId = `${uniquePrefix}-regen-btn`;
  const regenStatusId = `${uniquePrefix}-regen-status`;
  let description = data.job_description || 'Not found.';

  const keyMappings = {
    job_company: 'Company', job_title: 'Title', job_salary: 'Salary',
    job_location: 'Location', job_url_direct: 'Direct Link'
  };

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
      <button id="${copyBtnId}" class="copy-button" title="Copy description">Copy</button>
      <button id="${regenBtnId}" class="regen-button" title="Regenerate assessment">Regenerate Assessment</button>
      <span id="${regenStatusId}" class="regen-status"></span>
    </div>
    <h4><span>Description</span></h4>
    <pre id="${descriptionId}" class="job-description">${description}</pre>
  `;

  const threeColumn = ['Requirement', 'Match', 'Match Reason'];
  const oneColumn = ['Requirement'];
  detailsHtml += createQualificationTable('Required Qualifications', data.required_qualifications, threeColumn);
  detailsHtml += createQualificationTable('Additional Qualifications', data.additional_qualifications, threeColumn);
  detailsHtml += createQualificationTable('Evaluated Qualifications', data.evaluated_qualifications, oneColumn);

  return detailsHtml;
}

// --- UPDATED FUNCTION ---
// Renders the summary view and attaches all necessary event listeners.
function renderJob(task) {
  const jobItem = document.createElement('div');
  jobItem.className = 'job-item';
  jobItem.id = task.id;

  const title = task.data?.job_title || 'Processing...';
  const company = task.data?.job_company || '';
  const displayTitle = company ? `${title} at ${company}` : title;

  let errorHtml = '';
  if (task.status === 'error') {
    errorHtml = `<div class="job-error"><strong>Error:</strong> ${task.error}</div>`;
  }

  jobItem.innerHTML = `
    <div class="job-header">
      <div class="job-title">${displayTitle}</div>
      <div class="job-status status-${task.status}">${task.status}</div>
    </div>
    ${errorHtml}
    <div class="details-container"></div>
  `;

  const header = jobItem.querySelector('.job-header');
  const detailsContainer = jobItem.querySelector('.details-container');

  if (task.status === 'completed') {
    header.classList.add('clickable');
    header.addEventListener('click', () => {
      const isVisible = detailsContainer.style.display === 'block';
      if (isVisible) {
        detailsContainer.style.display = 'none';
        jobItem.classList.remove('expanded');
      } else {
        if (!detailsContainer.innerHTML) {
          // --- NEW --- Add the task ID to the data object before rendering
          // This makes it easy to generate unique IDs for sub-elements
          task.data.task_id = task.id;
          detailsContainer.innerHTML = renderJobDetails(task.data);
          const uniquePrefix = `details-${task.id}-${task.data.job_id || 'no-job-id'}`;
          const copyBtn = document.getElementById(`${uniquePrefix}-copy-btn`);
          const descriptionEl = document.getElementById(`${uniquePrefix}-desc`);
          const regenBtn = document.getElementById(`${uniquePrefix}-regen-btn`);
          const regenStatusEl = document.getElementById(`${uniquePrefix}-regen-status`);

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

          if (regenBtn && task.data?.job_id) {
            regenBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              if (regenBtn.disabled) return;
              regenBtn.disabled = true;
              const originalText = regenBtn.textContent;
              regenBtn.textContent = 'Regenerating...';
              regenStatusEl.textContent = '';
              try {
                const resp = await regenerateAssessment(task.data.job_id);
                if (resp.status === 'success' && resp.data) {
                  // Update task data and storage
                  task.data = resp.data;
                  task.data.task_id = task.id; // preserve for rendering
                  await browser.storage.local.set({ [task.id]: task });
                  // Re-render details
                  detailsContainer.innerHTML = renderJobDetails(task.data);
                  // Re-bind buttons after re-render
                  const newCopyBtn = document.getElementById(`${uniquePrefix}-copy-btn`);
                  const newDescriptionEl = document.getElementById(`${uniquePrefix}-desc`);
                  const newRegenBtn = document.getElementById(`${uniquePrefix}-regen-btn`);
                  const newRegenStatusEl = document.getElementById(`${uniquePrefix}-regen-status`);
                  if (newCopyBtn && newDescriptionEl) {
                    newCopyBtn.addEventListener('click', (e2) => {
                      e2.stopPropagation();
                      navigator.clipboard.writeText(newDescriptionEl.textContent).then(() => {
                        newCopyBtn.textContent = 'Copied!';
                        setTimeout(() => { newCopyBtn.textContent = 'Copy'; }, 2000);
                      }).catch(err => {
                        console.error('Failed to copy text: ', err);
                        newCopyBtn.textContent = 'Error!';
                      });
                    });
                  }
                  if (newRegenBtn) {
                    newRegenBtn.addEventListener('click', (e3) => {
                      e3.stopPropagation();
                      // Recursively call handler by triggering click on original regen logic
                      regenBtn.click();
                    });
                  }
                  regenStatusEl.textContent = 'Updated';
                } else {
                  regenStatusEl.textContent = 'Failed';
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
        jobItem.classList.add('expanded');
      }
    });
  }

  return jobItem;
}

async function renderAllJobs() {
  const allTasks = await browser.storage.local.get(null);
  jobListContainer.innerHTML = '';

  const sortedTasks = Object.values(allTasks).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  if (sortedTasks.length === 0) {
    jobListContainer.innerHTML = '<p>No jobs have been processed yet.</p>';
    return;
  }

  for (const task of sortedTasks) {
    const jobElement = renderJob(task);
    jobListContainer.appendChild(jobElement);
  }
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    renderAllJobs();
  }
});

clearHistoryBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete all job history? This cannot be undone.')) {
    await browser.storage.local.clear();
    renderAllJobs();
  }
});

document.addEventListener('DOMContentLoaded', renderAllJobs);