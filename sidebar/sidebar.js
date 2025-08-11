/**
 * This function is injected into the active tab to scrape the content.
 */
function scrapeTargetElement() {
  const selector = 'div.jobs-search__job-details--wrapper';
  const targetElement = document.querySelector(selector);
  return targetElement ? targetElement.outerHTML : null;
}

/**
 * Renders a simple text message in the status area.
 * @param {string} message The message to display.
 * @param {'success'|'error'|''} type The type of message for styling.
 */
function updateStatusMessage(message, type) {
  const statusDiv = document.getElementById('status-message');
  statusDiv.innerHTML = `<p>${message}</p>`; // Use innerHTML to wrap in a paragraph
  statusDiv.className = type;
}

/**
 * Takes the job data object and renders it as a formatted table in the sidebar.
 * @param {object} data The job data object from the API.
 */
function displayJobData(data) {
  const statusDiv = document.getElementById('status-message');
  let description = data.job_description || "Not found.";

  // A mapping from JSON keys to human-readable labels
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
      // Make the direct URL a clickable link that opens in a new tab
      if (key === 'job_url_direct' && value !== "N/A") {
        value = `<a href="${value}" target="_blank">View Job</a>`;
      }
      tableHtml += `<tr><td>${keyMappings[key]}</td><td>${value}</td></tr>`;
    }
  }
  tableHtml += '</table>';

  // Add the description below the table
  tableHtml += `<h4>Description</h4><pre class="job-description">${description}</pre>`;

  statusDiv.innerHTML = tableHtml;
  statusDiv.className = 'success'; // Apply success styling to the container
}

/**
 * Main function to orchestrate the extraction process.
 */
async function extractAndProcess() {
  const extractBtn = document.getElementById('extract-btn');
  extractBtn.disabled = true;
  updateStatusMessage('Extracting content...', '');

  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!activeTab.url?.startsWith("http")) {
    updateStatusMessage("Error: This extension can only run on web pages (http/https).", "error");
    extractBtn.disabled = false;
    return;
  }

  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: scrapeTargetElement,
    });
    const htmlContent = results[0].result;
    if (htmlContent) {
      await sendToApi(htmlContent, activeTab.url);
    } else {
      const selector = 'div.jobs-search__job-details--wrapper';
      updateStatusMessage(`Error: The target element ('${selector}') was not found.`, 'error');
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
  const endpoint = 'http://127.0.0.1:8000/html_extract';
  updateStatusMessage('Sending data to the server...', '');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: html, url: url }),
    });
    const responseData = await response.json();
    if (response.ok) {
      // Instead of showing a simple message, render the data table
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