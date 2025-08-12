/**
 * --- UPDATED ---
 * This function is injected into the active tab to scrape the content.
 * It now accepts an array of selectors and tries them in order.
 * @param {string[]} selectors An array of CSS selectors to try.
 */
function scrapeTargetElement(selectors) {
  // Loop through the provided selectors
  for (const selector of selectors) {
    const targetElement = document.querySelector(selector);
    // If an element is found with the current selector, return its HTML immediately
    if (targetElement) {
      return targetElement.outerHTML;
    }
  }
  // If the loop finishes without finding any matching elements, return null.
  return null;
}

/**
 * Renders a simple text message in the status area.
 */
function updateStatusMessage(message, type) {
  // ... (This function remains unchanged)
  const statusDiv = document.getElementById('status-message');
  statusDiv.innerHTML = `<p>${message}</p>`;
  statusDiv.className = type;
}

/**
 * Creates and returns the HTML string for a qualifications table.
 */
function createQualificationTable(title, qualificationsArray, headers) {
  // ... (This function remains unchanged)
  if (!qualificationsArray || qualificationsArray.length === 0) {
    return '';
  }

  let matchFraction = '';
  if (headers.length === 3) {
    const totalMatches = qualificationsArray.filter(item => item.match === 1).length;
    const totalRequirements = qualificationsArray.length;
    matchFraction = `<span class="match-fraction">(${totalMatches}/${totalRequirements})</span>`;
  }

  let tableHtml = `<h4><span>${title}</span>${matchFraction}</h4>`;
  tableHtml += `<table class="qualification-table" data-columns="${headers.length}">`;
  tableHtml += '<thead><tr>';
  headers.forEach(header => {
    tableHtml += `<th>${header}</th>`;
  });
  tableHtml += '</tr></thead><tbody>';

  for (const item of qualificationsArray) {
    tableHtml += '<tr>';
    if (headers.includes('Requirement')) {
      tableHtml += `<td>${item.requirement || 'N/A'}</td>`;
    }
    if (headers.includes('Match')) {
      const isMatch = item.match === 1;
      const matchText = isMatch ? 'Yes' : 'No';
      const matchClass = isMatch ? 'match-yes' : 'match-no';
      tableHtml += `<td class="${matchClass}">${matchText}</td>`;
    }
    if (headers.includes('Match Reason')) {
      tableHtml += `<td>${item.match_reason || 'N/A'}</td>`;
    }
    tableHtml += '</tr>';
  }

  tableHtml += '</tbody></table>';
  return tableHtml;
}

/**
 * Takes the job data object and renders it as a formatted set of tables.
 */
function displayJobData(data) {
  // ... (This function remains unchanged)
  const statusDiv = document.getElementById('status-message');
  const descriptionId = "job-description-text";
  let description = data.job_description || "Not found.";

  const keyMappings = {
    job_company: "Company",
    job_title: "Title",
    job_salary: "Salary",
    job_location: "Location",
    job_url_direct: "Direct Link",
  };

  let tableHtml = '<table class="job-data-table">';
  for (const key in keyMappings) {
    if (data.hasOwnProperty(key)) {
      let value = data[key] || "N/A";
      if (key === 'job_url_direct' && value !== "N/A") {
        const jobId = data.job_id || '';
        const linkText = `View Job ${jobId}`.trim();
        value = `<a href="${value}" target="_blank">${linkText}</a>`;
      }
      tableHtml += `<tr><td>${keyMappings[key]}</td><td>${value}</td></tr>`;
    }
  }
  tableHtml += '</table>';

  tableHtml += `
    <h4>
      <span>Description</span>
      <button id="copy-desc-btn" class="copy-button" title="Copy description to clipboard">Copy</button>
    </h4>
    <pre id="${descriptionId}" class="job-description">${description}</pre>
  `;
  
  const threeColumn = ['Requirement', 'Match', 'Match Reason'];
  const oneColumn = ['Requirement'];

  tableHtml += createQualificationTable("Required Qualifications", data.required_qualifications, threeColumn);
  tableHtml += createQualificationTable("Additional Qualifications", data.additional_qualifications, threeColumn);
  tableHtml += createQualificationTable("Evaluated Qualifications", data.evaluated_qualifications, oneColumn);

  statusDiv.innerHTML = tableHtml;
  statusDiv.className = 'success';

  const copyBtn = document.getElementById('copy-desc-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const descriptionText = document.getElementById(descriptionId).textContent;
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        navigator.clipboard.writeText(descriptionText).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        }).catch(err => {
          console.error('Failed to copy text: ', err);
          if (err && err.name === 'NotAllowedError') {
            copyBtn.textContent = 'Permission denied!';
          } else {
            copyBtn.textContent = 'Error!';
          }
        });
      } else {
        console.error('Clipboard API not available or insecure context.');
        copyBtn.textContent = 'Clipboard unavailable!';
      }
    });
  }
}

/**
 * Main function to orchestrate the extraction process.
 */
async function extractAndProcess() {
  const extractBtn = document.getElementById('extract-btn');
  extractBtn.disabled = true;
  updateStatusMessage('Extracting content...', '');

  let activeTab;
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      updateStatusMessage("Error: No active tab found. Please select a tab and try again.", "error");
      extractBtn.disabled = false;
      return;
    }
    activeTab = tabs[0];
  } catch (err) {
    console.error("Error querying active tab:", err);
    updateStatusMessage("Error: Could not get the active tab.", "error");
    extractBtn.disabled = false;
    return;
  }

  if (!activeTab.url?.startsWith("http")) {
    updateStatusMessage("Error: This extension can only run on web pages (http/https).", "error");
    extractBtn.disabled = false;
    return;
  }

  // --- NEW --- Define the list of selectors to try
  const targetSelectors = [
    'div.jobs-search__job-details--wrapper',
    'div.jobs-semantic-search-job-details-wrapper'
  ];

  try {
    // --- UPDATED --- Pass the selectors array as an argument to the function
    const results = await browser.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: scrapeTargetElement,
      args: [targetSelectors] // Pass the array here
    });

    const htmlContent = results[0].result;
    if (htmlContent) {
      await sendToApi(htmlContent, activeTab.url);
    } else {
      // --- UPDATED --- More informative error message
      updateStatusMessage(`Error: Could not find any of the target elements on this page.`, 'error');
    }
  } catch (error) {
    console.error("Error during script execution:", error);
    updateStatusMessage(`An error occurred: ${error.message}`, 'error');
  } finally {
    extractBtn.disabled = false;
  }
}

/**
 * Sends the extracted data to the API and updates the UI with the response.
 */
async function sendToApi(html, url) {
  // Get the API endpoint from browser storage, fallback to default if not set
  let endpoint = 'http://127.0.0.1:8000/html_extract';
  try {
    const result = await browser.storage.local.get('apiEndpoint');
    if (result.apiEndpoint) {
      endpoint = result.apiEndpoint;
    }
  } catch (e) {
    // If storage access fails, use default endpoint
    console.warn('Could not retrieve API endpoint from storage, using default.', e);
  }
  updateStatusMessage('Sending data to the server...', '');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: html, url: url }),
    });
    const responseData = await response.json();
    if (response.ok) {
      displayJobData(responseData.data);
    } else {
      updateStatusMessage(`API Error (${response.status}): ${responseData.detail}`, 'error');
    }
  } catch (error) {
    console.error("Error sending data to API:", error);
    updateStatusMessage(`Network Error: Could not connect to the API.`, 'error');
  }
}

document.getElementById('extract-btn').addEventListener('click', extractAndProcess);