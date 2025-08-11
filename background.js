// Listens for the action (button) click
browser.action.onClicked.addListener(handleClick);

// This function contains the logic that used to be in content.js
// It will be executed in the context of the web page.
function scrapeTargetElement() {
  const selector = 'div.jobs-search__job-details--wrapper';
  const targetElement = document.querySelector(selector);
  
  // If the element is found, return its HTML. Otherwise, return null.
  if (targetElement) {
    return targetElement.outerHTML;
  }
  return null;
}

async function handleClick(tab) {
  if (!tab.url?.startsWith("http")) {
    const message = "This extension can only run on web pages (http or https).";
    notify("Action Failed", message);
    return;
  }

  try {
    // Inject the function directly, instead of a file
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeTargetElement, // <-- Key change here
    });

    const htmlContent = results[0].result;
    if (htmlContent) {
      sendHtmlToApi(htmlContent, tab.url);
    } else {
      // Provide a more specific error message to the user
      const selector = 'div.jobs-search__job-details--wrapper';
      notify("Extraction Failed", `The target element ('${selector}') was not found on this page.`);
    }
  } catch (error) {
    console.error("Error executing script:", error);
    notify("Error", `Failed to execute script. Error: ${error.message}`);
  }
}

async function sendHtmlToApi(html, url) {
  const endpoint = 'http://127.0.0.1:8000/html_extract'; 

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: html, url: url }),
    });

    const responseData = await response.json();

    if (response.ok) {
      notify("Success", responseData.message || "Operation successful.");
    } else {
      notify("API Error", responseData.detail || `An unknown error occurred. Status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending data to API:', error);
    notify("Network Error", "Could not connect to the API. Check the console for details.");
  }
}

function notify(title, message) {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/icon-48.png"),
    title: title,
    message: message
  });
}